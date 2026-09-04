-- 0017_regras_novos_status.sql
-- Completa o fluxo: envio, assuncao, pendencia e nao execucao.
-- Depende de 0016_novos_status_fluxo.sql.

-- Estas transições precisam existir antes da compatibilidade de dados, pois a
-- trigger atual valida qualquer atualização de status.
insert into status_transicoes_validas (status_origem, status_destino)
values
  ('EM_COMPRAS', 'ENVIADO_PARA_COMPRAS'),
  ('AGUARDANDO_EXECUCAO', 'ENVIADO_PARA_EXECUCAO')
on conflict do nothing;

-- Chamados antigos sem lock recebem a nomenclatura nova. Registros assumidos
-- permanecem na etapa operacional correspondente.
update chamados
set status = 'ENVIADO_PARA_COMPRAS'
where status = 'EM_COMPRAS'
  and assumido_por is null;

update chamados
set status = 'ENVIADO_PARA_EXECUCAO'
where status = 'AGUARDANDO_EXECUCAO'
  and assumido_por is null;

-- Remove os atalhos antigos e registra o fluxo novo.
delete from status_transicoes_validas
where (status_origem, status_destino) in (
  ('EM_ANALISE', 'EM_COMPRAS'),
  ('EM_COMPRAS', 'AGUARDANDO_EXECUCAO'),
  ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO'),
  ('EM_ANDAMENTO', 'FINALIZADO')
);

insert into status_transicoes_validas (status_origem, status_destino)
values
  ('EM_ANALISE', 'ENVIADO_PARA_COMPRAS'),
  ('ENVIADO_PARA_COMPRAS', 'EM_COMPRAS'),
  ('EM_COMPRAS', 'ENVIADO_PARA_COMPRAS'),
  ('EM_COMPRAS', 'ENVIADO_PARA_EXECUCAO'),
  ('ENVIADO_PARA_EXECUCAO', 'AGUARDANDO_EXECUCAO'),
  ('AGUARDANDO_EXECUCAO', 'ENVIADO_PARA_EXECUCAO'),
  ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO'),
  ('AGUARDANDO_EXECUCAO', 'PENDENTE'),
  ('AGUARDANDO_EXECUCAO', 'NAO_EXECUTADO'),
  ('EM_ANDAMENTO', 'PENDENTE'),
  ('EM_ANDAMENTO', 'FINALIZADO'),
  ('EM_ANDAMENTO', 'NAO_EXECUTADO'),
  ('PENDENTE', 'EM_ANDAMENTO'),
  ('PENDENTE', 'FINALIZADO'),
  ('PENDENTE', 'NAO_EXECUTADO'),
  ('ENVIADO_PARA_COMPRAS', 'CANCELADO'),
  ('EM_COMPRAS', 'CANCELADO'),
  ('ENVIADO_PARA_EXECUCAO', 'CANCELADO'),
  ('AGUARDANDO_EXECUCAO', 'CANCELADO'),
  ('EM_ANDAMENTO', 'CANCELADO'),
  ('PENDENTE', 'CANCELADO'),
  ('NAO_EXECUTADO', 'EM_ANALISE')
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
  elsif new.status in ('EM_COMPRAS', 'ENVIADO_PARA_COMPRAS') then
    if new.status = 'EM_COMPRAS' and new.numero_chamado is null then
      new.numero_chamado := gerar_numero_chamado();
    end if;
    if new.status = 'EM_COMPRAS' then
      new.aprovado_em := coalesce(new.aprovado_em, now());
      new.em_compras_em := coalesce(new.em_compras_em, now());
    end if;
  elsif new.status in ('ENVIADO_PARA_EXECUCAO', 'AGUARDANDO_EXECUCAO') then
    if new.observacao_compras is not null and btrim(new.observacao_compras) = '' then
      raise exception 'observacao_compras não pode ser vazia quando informada';
    end if;
    if new.status = 'AGUARDANDO_EXECUCAO' then
      new.aguardando_execucao_em := coalesce(new.aguardando_execucao_em, now());
    end if;
  elsif new.status = 'EM_ANDAMENTO' then
    if new.artifice_id is null then
      raise exception 'artifice_id é obrigatório para iniciar a execução do chamado';
    end if;
    new.em_andamento_em := coalesce(new.em_andamento_em, now());
  elsif new.status = 'PENDENTE' then
    if new.observacao_artifice is null or btrim(new.observacao_artifice) = '' then
      raise exception 'observacao_artifice é obrigatória para marcar o chamado como pendente';
    end if;
  elsif new.status = 'FINALIZADO' then
    if new.executado = false then
      raise exception 'Use o status NAO_EXECUTADO para registrar uma não execução';
    end if;
    if not exists (
      select 1 from chamado_anexos
      where chamado_id = new.id and tipo = 'FOTO_DEPOIS'
    ) then
      raise exception 'A foto do depois é obrigatória para concluir o chamado';
    end if;
    new.finalizado_em := now();
  elsif new.status = 'NAO_EXECUTADO' then
    if new.motivo_nao_execucao is null or btrim(new.motivo_nao_execucao) = '' then
      raise exception 'motivo_nao_execucao é obrigatório';
    end if;
    new.executado := false;
  elsif new.status = 'CANCELADO' then
    new.cancelado_em := now();
  elsif new.status = 'EM_ANALISE' and old.status in ('FINALIZADO', 'NAO_EXECUTADO') then
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
  novo_status status_chamado;
begin
  if eu is null or papel_atual not in ('COMPRAS', 'ARTIFICE') then
    raise exception 'Somente Compras ou Artífice podem assumir chamados';
  end if;

  select * into registro from chamados where id = p_chamado_id for update;
  if registro.id is null then raise exception 'Chamado não encontrado'; end if;
  if papel_atual = 'COMPRAS' and registro.status not in ('ENVIADO_PARA_COMPRAS', 'EM_COMPRAS') then
    raise exception 'Este chamado não está disponível para Compras';
  end if;
  if papel_atual = 'ARTIFICE' and registro.status not in ('ENVIADO_PARA_EXECUCAO', 'AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO', 'PENDENTE') then
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

  novo_status := case
    when papel_atual = 'COMPRAS' and registro.status = 'ENVIADO_PARA_COMPRAS' then 'EM_COMPRAS'::status_chamado
    when papel_atual = 'ARTIFICE' and registro.status = 'ENVIADO_PARA_EXECUCAO' then 'AGUARDANDO_EXECUCAO'::status_chamado
    else registro.status
  end;

  update chamados
  set status = novo_status,
      assumido_por = eu,
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
  novo_status status_chamado;
begin
  select * into registro from chamados where id = p_chamado_id for update;
  if registro.id is null then raise exception 'Chamado não encontrado'; end if;
  if registro.assumido_por <> eu then raise exception 'Você não possui o lock deste chamado'; end if;
  if papel_atual = 'ARTIFICE' and registro.status in ('EM_ANDAMENTO', 'PENDENTE') then
    raise exception 'Finalize ou marque a execução antes de liberar um chamado em andamento';
  end if;

  novo_status := case
    when papel_atual = 'COMPRAS' and registro.status = 'EM_COMPRAS' then 'ENVIADO_PARA_COMPRAS'::status_chamado
    when papel_atual = 'ARTIFICE' and registro.status = 'AGUARDANDO_EXECUCAO' then 'ENVIADO_PARA_EXECUCAO'::status_chamado
    else registro.status
  end;

  update chamados
  set status = novo_status,
      assumido_por = null,
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

grant execute on function assumir_chamado(uuid) to authenticated;
grant execute on function liberar_chamado(uuid) to authenticated;

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
      when 'ENVIADO_PARA_COMPRAS' then new.observacao_aprovacao
      when 'EM_COMPRAS' then 'Chamado assumido pelo setor de compras.'
      when 'ENVIADO_PARA_EXECUCAO' then new.observacao_compras
      when 'AGUARDANDO_EXECUCAO' then 'Chamado assumido para execução.'
      when 'EM_ANDAMENTO' then new.observacao_artifice
      when 'PENDENTE' then new.observacao_artifice
      when 'FINALIZADO' then new.observacao_artifice
      when 'NAO_EXECUTADO' then new.motivo_nao_execucao
      when 'EM_ANALISE' then new.observacao_reabertura
      else null
    end;
    if new.status = 'EM_ANALISE' and old.status in ('FINALIZADO', 'NAO_EXECUTADO') then
      evento_atual := 'REABERTURA';
    end if;
    responsavel := coalesce(responsavel, case new.status
      when 'ENVIADO_PARA_COMPRAS' then new.aprovado_por
      when 'EM_COMPRAS' then new.assumido_por
      when 'ENVIADO_PARA_EXECUCAO' then new.compras_por
      when 'AGUARDANDO_EXECUCAO' then new.artifice_id
      when 'EM_ANDAMENTO' then new.artifice_id
      when 'PENDENTE' then new.artifice_id
      when 'FINALIZADO' then new.artifice_id
      when 'NAO_EXECUTADO' then new.artifice_id
      else null
    end);
    detalhes_atual := jsonb_build_object('status_anterior', old.status, 'status_novo', new.status, 'executado', new.executado, 'artifice_id', new.artifice_id);
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
    observacao_atual := coalesce(new.motivo_nao_execucao, new.observacao_artifice, new.observacao_compras, new.observacao_aprovacao);
  end if;

  if evento_atual <> 'STATUS' or new.status is distinct from old.status then
    insert into chamado_historico
      (chamado_id, status_anterior, status_novo, observacao, usuario_id, evento, detalhes)
    values (new.id, old.status, new.status, observacao_atual, responsavel, evento_atual, detalhes_atual);
  end if;
  return new;
end;
$$;

-- A leitura interna é ampla por regra de negócio; edição continua restrita.
drop policy if exists "chamados_select_interno" on chamados;
drop policy if exists "chamados_select_equipe_todos_condominios" on chamados;
create policy "chamados_select_equipe_todos_condominios" on chamados
  for select to authenticated using (meu_papel() is not null);

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
    and status in ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO', 'PENDENTE')
    and (artifice_id is null or artifice_id = meu_usuario_id())
  ) with check (
    meu_papel() = 'ARTIFICE'
    and assumido_por = meu_usuario_id()
    and (artifice_id is null or artifice_id = meu_usuario_id())
  );
