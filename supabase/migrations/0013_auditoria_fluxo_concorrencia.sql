-- =============================================================================
-- 0013_auditoria_fluxo_concorrencia.sql
-- Integridade final do fluxo, protocolo imediato, reabertura parametrizável,
-- trilha de auditoria detalhada e lock atômico para Compras/Artífice.
-- Compatível com chamados antigos: colunas novas são opcionais para dados já
-- existentes e o protocolo é preenchido retroativamente.
-- =============================================================================

alter table chamados
  add column if not exists morador_email text,
  add column if not exists observacao_reabertura text,
  add column if not exists reaberto_em timestamptz,
  add column if not exists assumido_por uuid references usuarios(id) on delete set null,
  add column if not exists assumido_em timestamptz,
  add column if not exists bloqueio_expira_em timestamptz,
  add column if not exists versao integer not null default 1;

alter table chamado_historico
  add column if not exists evento text not null default 'STATUS',
  add column if not exists detalhes jsonb not null default '{}'::jsonb;

create index if not exists idx_chamados_bloqueio on chamados (assumido_por, bloqueio_expira_em);
create index if not exists idx_chamados_atualizado_em on chamados (atualizado_em desc);
create index if not exists idx_historico_evento on chamado_historico (chamado_id, evento, criado_em);

comment on column chamados.morador_email is 'E-mail obrigatório para novas solicitações; nullable apenas para compatibilidade com dados legados.';
comment on column chamados.assumido_por is 'Usuário interno que possui o lock operacional temporário do chamado.';
comment on column chamados.versao is 'Versão otimista do registro, incrementada a cada atualização.';
comment on column chamado_historico.evento is 'Tipo do evento auditado: ABERTURA, STATUS, ATRIBUICAO, ATENDIMENTO, OBSERVACAO ou REABERTURA.';

-- O morador informa e-mail nas novas aberturas. Dados antigos sem e-mail não
-- são apagados nem impedem a aplicação de subir.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_morador_email_formato'
      and conrelid = 'public.chamados'::regclass
  ) then
    alter table chamados add constraint chk_morador_email_formato
      check (morador_email is null or morador_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
  end if;
end $$;

-- Reabertura fica configurável por chave, sem precisar alterar código.
create table if not exists configuracoes_sistema (
  chave text primary key,
  valor_booleano boolean not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references usuarios(id) on delete set null
);

insert into configuracoes_sistema (chave, valor_booleano)
values ('permitir_reabertura_morador', true)
on conflict (chave) do nothing;

alter table configuracoes_sistema enable row level security;
drop policy if exists "configuracoes_select_admin" on configuracoes_sistema;
drop policy if exists "configuracoes_update_admin_master" on configuracoes_sistema;
create policy "configuracoes_select_admin" on configuracoes_sistema
  for select using (meu_papel() = 'ADMIN');
create policy "configuracoes_update_admin_master" on configuracoes_sistema
  for update using (meu_admin_master())
  with check (meu_admin_master());

-- Protocolo gerado no INSERT, antes da policy de RLS avaliar a nova linha.
create or replace function atribuir_numero_chamado_inicial()
returns trigger
language plpgsql
as $$
begin
  if new.numero_chamado is null or btrim(new.numero_chamado) = '' then
    new.numero_chamado := gerar_numero_chamado();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_atribuir_numero_chamado_inicial on chamados;
create trigger trg_atribuir_numero_chamado_inicial
  before insert on chamados
  for each row
  execute function atribuir_numero_chamado_inicial();

-- Abertura pública com retorno seguro do protocolo. Evita liberar SELECT da
-- tabela de chamados apenas para usar INSERT ... RETURNING no navegador.
create or replace function abrir_chamado_publico(
  p_id uuid,
  p_condominio_id uuid,
  p_morador_nome text,
  p_morador_whatsapp text,
  p_morador_email text,
  p_local_problema text,
  p_tipo_problema tipo_problema,
  p_descricao text
)
returns table (id uuid, numero_chamado text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from condominios where condominios.id = p_condominio_id and ativo = true) then
    raise exception 'Condomínio não encontrado ou inativo';
  end if;
  if btrim(coalesce(p_morador_nome, '')) = '' or btrim(coalesce(p_morador_whatsapp, '')) = ''
     or btrim(coalesce(p_morador_email, '')) = '' or btrim(coalesce(p_local_problema, '')) = ''
     or btrim(coalesce(p_descricao, '')) = '' then
    raise exception 'Todos os campos obrigatórios devem ser preenchidos';
  end if;
  insert into chamados (id, condominio_id, morador_nome, morador_whatsapp, morador_email,
                        local_problema, tipo_problema, descricao)
  values (p_id, p_condominio_id, btrim(p_morador_nome), btrim(p_morador_whatsapp),
          lower(btrim(p_morador_email)), btrim(p_local_problema), p_tipo_problema, btrim(p_descricao));
  return query select c.id, c.numero_chamado from chamados c where c.id = p_id;
end;
$$;

grant execute on function abrir_chamado_publico(uuid, uuid, text, text, text, text, tipo_problema, text) to anon, authenticated;

-- Preenche protocolos dos dados já existentes que foram criados antes desta
-- migration. A sequência mantém unicidade entre os chamados.
update chamados
set numero_chamado = gerar_numero_chamado()
where numero_chamado is null;

-- Reabertura é a única transição intencional de retorno no fluxo.
insert into status_transicoes_validas (status_origem, status_destino)
values ('FINALIZADO', 'EM_ANALISE')
on conflict do nothing;

create or replace function validar_transicao_chamado()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    new.versao := old.versao + 1;
    new.atualizado_em := now();
    return new;
  end if;

  if not exists (
    select 1 from status_transicoes_validas
    where status_origem = old.status and status_destino = new.status
  ) then
    raise exception 'Transição de status inválida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'REJEITADO' then
    if new.motivo_rejeicao is null or btrim(new.motivo_rejeicao) = '' then
      raise exception 'motivo_rejeicao é obrigatório ao rejeitar um chamado';
    end if;
    new.rejeitado_em := now();
  elsif new.status = 'EM_COMPRAS' then
    if new.numero_chamado is null then
      new.numero_chamado := gerar_numero_chamado();
    end if;
    new.aprovado_em := coalesce(new.aprovado_em, now());
    new.em_compras_em := coalesce(new.em_compras_em, now());
  elsif new.status = 'AGUARDANDO_EXECUCAO' then
    if new.observacao_compras is not null and btrim(new.observacao_compras) = '' then
      raise exception 'observacao_compras não pode ser vazia quando informada';
    end if;
    new.aguardando_execucao_em := coalesce(new.aguardando_execucao_em, now());
  elsif new.status = 'EM_ANDAMENTO' then
    if new.artifice_id is null then
      raise exception 'artifice_id é obrigatório para iniciar a execução do chamado';
    end if;
    new.em_andamento_em := coalesce(new.em_andamento_em, now());
  elsif new.status = 'FINALIZADO' then
    if new.executado = true and not exists (
      select 1 from chamado_anexos
      where chamado_id = new.id and tipo = 'FOTO_DEPOIS'
    ) then
      raise exception 'A foto do depois é obrigatória para concluir o chamado';
    end if;
    new.finalizado_em := now();
  elsif new.status = 'CANCELADO' then
    new.cancelado_em := now();
  elsif new.status = 'EM_ANALISE' and old.status = 'FINALIZADO' then
    if new.observacao_reabertura is null or btrim(new.observacao_reabertura) = '' then
      raise exception 'observacao_reabertura é obrigatória ao reabrir um chamado';
    end if;
    new.reaberto_em := now();
  end if;

  new.versao := old.versao + 1;
  new.atualizado_em := now();
  return new;
end;
$$;

-- A trigger fica após o trigger original na ordem de criação; a definição
-- acima substitui a função usada por ele sem duplicar triggers.

create or replace function registrar_historico_chamado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  observacao_atual text;
  responsavel uuid;
  evento_atual text := 'STATUS';
  detalhes_atual jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into chamado_historico
      (chamado_id, status_anterior, status_novo, observacao, usuario_id, evento, detalhes)
    values
      (new.id, null, new.status, 'Chamado criado pelo morador', null, 'ABERTURA',
       jsonb_build_object('numero_chamado', new.numero_chamado));
    return new;
  end if;

  responsavel := meu_usuario_id();
  if new.status is distinct from old.status then
    observacao_atual := case new.status
      when 'REJEITADO' then new.motivo_rejeicao
      when 'EM_COMPRAS' then new.observacao_aprovacao
      when 'AGUARDANDO_EXECUCAO' then new.observacao_compras
      when 'EM_ANDAMENTO' then new.observacao_artifice
      when 'FINALIZADO' then case when new.executado = false then new.motivo_nao_execucao else new.observacao_artifice end
      when 'EM_ANALISE' then new.observacao_reabertura
      else null
    end;
    if new.status = 'EM_ANALISE' and old.status = 'FINALIZADO' then
      evento_atual := 'REABERTURA';
    end if;
    responsavel := coalesce(responsavel, case new.status
      when 'EM_COMPRAS' then new.aprovado_por
      when 'AGUARDANDO_EXECUCAO' then new.compras_por
      when 'EM_ANDAMENTO' then new.artifice_id
      when 'FINALIZADO' then new.artifice_id
      else null
    end);
    detalhes_atual := jsonb_build_object(
      'status_anterior', old.status,
      'status_novo', new.status,
      'executado', new.executado,
      'artifice_id', new.artifice_id
    );
  elsif new.assumido_por is distinct from old.assumido_por then
    evento_atual := 'ATENDIMENTO';
    observacao_atual := case when new.assumido_por is null then 'Chamado liberado para a fila.' else 'Chamado assumido para atendimento.' end;
    detalhes_atual := jsonb_build_object('atendido_por_anterior', old.assumido_por, 'atendido_por_novo', new.assumido_por, 'expira_em', new.bloqueio_expira_em);
  elsif new.artifice_id is distinct from old.artifice_id then
    evento_atual := 'ATRIBUICAO';
    observacao_atual := 'Artífice responsável atualizado.';
    detalhes_atual := jsonb_build_object('artifice_anterior', old.artifice_id, 'artifice_novo', new.artifice_id);
  elsif new.observacao_artifice is distinct from old.observacao_artifice
     or new.motivo_nao_execucao is distinct from old.motivo_nao_execucao
     or new.observacao_compras is distinct from old.observacao_compras
     or new.observacao_aprovacao is distinct from old.observacao_aprovacao then
    evento_atual := 'OBSERVACAO';
    observacao_atual := coalesce(
      case when new.motivo_nao_execucao is distinct from old.motivo_nao_execucao then new.motivo_nao_execucao end,
      case when new.observacao_artifice is distinct from old.observacao_artifice then new.observacao_artifice end,
      case when new.observacao_compras is distinct from old.observacao_compras then new.observacao_compras end,
      case when new.observacao_aprovacao is distinct from old.observacao_aprovacao then new.observacao_aprovacao end
    );
  end if;

  if evento_atual <> 'STATUS' or new.status is distinct from old.status then
    insert into chamado_historico
      (chamado_id, status_anterior, status_novo, observacao, usuario_id, evento, detalhes)
    values
      (new.id, old.status, new.status, observacao_atual, responsavel, evento_atual, detalhes_atual);
  end if;
  return new;
end;
$$;

-- Lock transacional: duas pessoas podem clicar simultaneamente, mas somente
-- uma recebe o chamado. O lock expira em 15 minutos e pode ser renovado.
create or replace function assumir_chamado(p_chamado_id uuid)
returns chamados
language plpgsql
security definer
set search_path = public
as $$
declare
  registro chamados;
  eu uuid := meu_usuario_id();
  papel_atual papel_usuario := meu_papel();
begin
  if eu is null or papel_atual not in ('COMPRAS', 'ARTIFICE') then
    raise exception 'Somente Compras ou Artífice podem assumir chamados';
  end if;

  select * into registro from chamados where id = p_chamado_id for update;
  if registro.id is null then raise exception 'Chamado não encontrado'; end if;
  if papel_atual = 'COMPRAS' and registro.status <> 'EM_COMPRAS' then
    raise exception 'Este chamado não está na fila de Compras';
  end if;
  if papel_atual = 'ARTIFICE' and registro.status not in ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO') then
    raise exception 'Este chamado não está disponível para execução';
  end if;
  if registro.assumido_por is not null
     and registro.assumido_por <> eu
     and registro.bloqueio_expira_em > now() then
    raise exception 'Chamado já está sendo atendido por outro usuário';
  end if;
  if papel_atual = 'ARTIFICE' and registro.artifice_id is not null and registro.artifice_id <> eu then
    raise exception 'Este chamado foi atribuído a outro artífice';
  end if;

  update chamados
  set assumido_por = eu,
      assumido_em = now(),
      bloqueio_expira_em = now() + interval '15 minutes',
      artifice_id = case when papel_atual = 'ARTIFICE' and registro.artifice_id is null then eu else artifice_id end,
      artifice_atribuido_por = case when papel_atual = 'ARTIFICE' and registro.artifice_id is null then eu else artifice_atribuido_por end,
      artifice_atribuido_em = case when papel_atual = 'ARTIFICE' and registro.artifice_id is null then now() else artifice_atribuido_em end
  where id = p_chamado_id;

  select * into registro from chamados where id = p_chamado_id;
  return registro;
end;
$$;

create or replace function liberar_chamado(p_chamado_id uuid)
returns chamados
language plpgsql
security definer
set search_path = public
as $$
declare
  registro chamados;
  eu uuid := meu_usuario_id();
  papel_atual papel_usuario := meu_papel();
begin
  select * into registro from chamados where id = p_chamado_id for update;
  if registro.id is null then raise exception 'Chamado não encontrado'; end if;
  if registro.assumido_por <> eu then raise exception 'Você não possui o lock deste chamado'; end if;
  if papel_atual = 'ARTIFICE' and registro.status = 'EM_ANDAMENTO' then
    raise exception 'Finalize ou marque a execução antes de liberar um chamado em andamento';
  end if;

  update chamados
  set assumido_por = null,
      assumido_em = null,
      bloqueio_expira_em = null,
      artifice_id = case when papel_atual = 'ARTIFICE' then null else artifice_id end,
      artifice_atribuido_por = case when papel_atual = 'ARTIFICE' then null else artifice_atribuido_por end,
      artifice_atribuido_em = case when papel_atual = 'ARTIFICE' then null else artifice_atribuido_em end
  where id = p_chamado_id;

  select * into registro from chamados where id = p_chamado_id;
  return registro;
end;
$$;

create or replace function reabrir_chamado(
  p_numero_chamado text,
  p_contato text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  registro chamados;
  contato_informado text := lower(trim(coalesce(p_contato, '')));
  telefone_informado text := regexp_replace(coalesce(p_contato, ''), '[^0-9]', '', 'g');
begin
  if not exists (
    select 1 from configuracoes_sistema
    where chave = 'permitir_reabertura_morador' and valor_booleano = true
  ) then
    raise exception 'A reabertura de chamados está desativada';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe um motivo para reabrir o chamado';
  end if;

  select * into registro from chamados
  where numero_chamado = nullif(trim(p_numero_chamado), '')
  limit 1;
  if registro.id is null then raise exception 'Chamado não encontrado'; end if;
  if registro.status <> 'FINALIZADO' then raise exception 'Somente chamados finalizados podem ser reabertos'; end if;
  if not (
    (registro.morador_email is not null and lower(registro.morador_email) = contato_informado)
    or regexp_replace(registro.morador_whatsapp, '[^0-9]', '', 'g') = telefone_informado
  ) then
    raise exception 'Contato não confere com o chamado';
  end if;

  update chamados
  set status = 'EM_ANALISE',
      observacao_reabertura = trim(p_motivo),
      executado = true,
      motivo_nao_execucao = null,
      assumido_por = null,
      assumido_em = null,
      bloqueio_expira_em = null
  where id = registro.id;

  return jsonb_build_object('id', registro.id, 'numero_chamado', registro.numero_chamado, 'status', 'EM_ANALISE');
end;
$$;

grant execute on function assumir_chamado(uuid) to authenticated;
grant execute on function liberar_chamado(uuid) to authenticated;
grant execute on function reabrir_chamado(text, text, text) to anon, authenticated;

-- A nova abertura precisa trazer e-mail e protocolo. O restante do formato
-- continua sendo validado pela policy existente.
drop policy if exists "chamados_insert_publico" on chamados;
create policy "chamados_insert_publico" on chamados
  for insert with check (
    status = 'EM_ANALISE'
    and numero_chamado is not null
    and morador_email is not null
    and btrim(morador_email) <> ''
    and motivo_rejeicao is null
    and observacao_compras is null
    and observacao_aprovacao is null
    and aprovado_por is null
    and compras_por is null
    and artifice_id is null
    and artifice_atribuido_por is null
    and artifice_atribuido_em is null
    and observacao_artifice is null
    and observacao_reabertura is null
    and motivo_nao_execucao is null
    and chat_aberto_em is null
    and aprovado_em is null
    and em_compras_em is null
    and aguardando_execucao_em is null
    and em_andamento_em is null
    and finalizado_em is null
    and cancelado_em is null
    and rejeitado_em is null
    and assumido_por is null
    and assumido_em is null
    and bloqueio_expira_em is null
    and executado = true
    and exists (select 1 from condominios c where c.id = condominio_id and c.ativo = true)
  );

-- Atualizações operacionais exigem lock próprio. Admin continua podendo atuar
-- em qualquer etapa para correção e supervisão.
drop policy if exists "chamados_update_compras" on chamados;
create policy "chamados_update_compras" on chamados
  for update using (
    meu_papel() = 'COMPRAS'
    and assumido_por = meu_usuario_id()
    and status = 'EM_COMPRAS'
  ) with check (meu_papel() = 'COMPRAS' and assumido_por = meu_usuario_id());

drop policy if exists "chamados_update_artifice" on chamados;
create policy "chamados_update_artifice" on chamados
  for update using (
    meu_papel() = 'ARTIFICE'
    and assumido_por = meu_usuario_id()
    and status in ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO')
    and (artifice_id is null or artifice_id = meu_usuario_id())
  ) with check (meu_papel() = 'ARTIFICE' and assumido_por = meu_usuario_id());

-- A consulta pública agora devolve os anexos que podem ser vistos pelo
-- morador, especialmente o anexo da rejeição. Dados internos continuam fora.
create or replace function consultar_chamado_publico(p_numero_chamado text)
returns table (chamado jsonb, anexos jsonb, historico jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select
    jsonb_build_object(
      'id', c.id, 'numero_chamado', c.numero_chamado, 'condominio_id', c.condominio_id,
      'morador_nome', c.morador_nome, 'morador_whatsapp', null, 'morador_email', null, 'local_problema', c.local_problema,
      'tipo_problema', c.tipo_problema, 'descricao', c.descricao, 'status', c.status,
      'motivo_rejeicao', c.motivo_rejeicao, 'observacao_compras', c.observacao_compras,
      'observacao_aprovacao', c.observacao_aprovacao, 'aprovado_por', null, 'compras_por', null,
      'artifice_id', null, 'criado_em', c.criado_em, 'aprovado_em', c.aprovado_em,
      'em_compras_em', c.em_compras_em, 'aguardando_execucao_em', c.aguardando_execucao_em,
      'em_andamento_em', c.em_andamento_em, 'finalizado_em', c.finalizado_em,
      'cancelado_em', c.cancelado_em, 'rejeitado_em', c.rejeitado_em, 'atualizado_em', c.atualizado_em,
      'artifice_atribuido_por', null, 'artifice_atribuido_em', null,
      'observacao_artifice', c.observacao_artifice, 'executado', c.executado,
      'motivo_nao_execucao', c.motivo_nao_execucao, 'chat_aberto_em', c.chat_aberto_em,
      'observacao_reabertura', c.observacao_reabertura
    ),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'chamado_id', a.chamado_id, 'tipo', a.tipo, 'url', a.url,
      'descricao', a.descricao, 'valor', null, 'enviado_por', null, 'criado_em', a.criado_em
    ) order by a.criado_em) from chamado_anexos a
      where a.chamado_id = c.id and a.tipo in ('FOTO_SOLICITACAO', 'ANEXO_REJEICAO', 'FOTO_DEPOIS')), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', h.id, 'chamado_id', h.chamado_id, 'status_anterior', h.status_anterior,
      'status_novo', h.status_novo, 'observacao', h.observacao, 'usuario_id', null,
      'evento', h.evento, 'detalhes', '{}'::jsonb, 'criado_em', h.criado_em
    ) order by h.criado_em) from chamado_historico h where h.chamado_id = c.id), '[]'::jsonb)
  from chamados c
  where c.numero_chamado = nullif(trim(p_numero_chamado), '')
    and c.numero_chamado is not null
  limit 1;
$$;
