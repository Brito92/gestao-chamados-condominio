-- =============================================================================
-- 0002_state_machine.sql
-- Numeração automática de chamados + máquina de estados (state machine)
-- aplicada via trigger no banco, garantindo integridade independentemente
-- de qual client (frontend, script, etc.) faça o update.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sequência usada para gerar o número de chamado no formato AAAA-000001
-- -----------------------------------------------------------------------------
create sequence if not exists chamado_numero_seq start 1;

create or replace function gerar_numero_chamado()
returns text
language plpgsql
as $$
declare
  proximo_numero bigint;
begin
  proximo_numero := nextval('chamado_numero_seq');
  return to_char(now(), 'YYYY') || '-' || lpad(proximo_numero::text, 6, '0');
end;
$$;

comment on function gerar_numero_chamado() is 'Gera o número público do chamado (ex: 2026-000001), atribuído apenas na aprovação do admin.';

-- -----------------------------------------------------------------------------
-- Tabela de transições válidas da state machine.
-- Mantê-la como dado (em vez de só lógica no código) facilita auditoria
-- e permite consultar "quais transições existem" via SQL.
-- -----------------------------------------------------------------------------
create table status_transicoes_validas (
  status_origem  status_chamado not null,
  status_destino status_chamado not null,
  primary key (status_origem, status_destino)
);

insert into status_transicoes_validas (status_origem, status_destino) values
  ('EM_ANALISE', 'EM_COMPRAS'),          -- admin aprova a solicitação
  ('EM_ANALISE', 'REJEITADO'),           -- admin rejeita a solicitação
  ('EM_ANALISE', 'CANCELADO'),           -- admin cancela por duplicidade/inconsistência
  ('EM_COMPRAS', 'AGUARDANDO_EXECUCAO'), -- compras finaliza (com ou sem compra real)
  ('EM_COMPRAS', 'CANCELADO'),
  ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO'), -- artífice inicia o serviço
  ('AGUARDANDO_EXECUCAO', 'CANCELADO'),
  ('EM_ANDAMENTO', 'FINALIZADO'),        -- artífice conclui com fotos antes/depois
  ('EM_ANDAMENTO', 'CANCELADO');

comment on table status_transicoes_validas is 'Grafo de transições permitidas na máquina de estados dos chamados.';

-- -----------------------------------------------------------------------------
-- Função de validação + efeitos colaterais da transição de status.
-- Executada BEFORE UPDATE em `chamados` sempre que o status muda.
-- -----------------------------------------------------------------------------
create or replace function validar_transicao_chamado()
returns trigger
language plpgsql
as $$
begin
  -- Nenhuma mudança de status: nada a validar aqui.
  if new.status = old.status then
    new.atualizado_em := now();
    return new;
  end if;

  -- A transição precisa existir no grafo de transições válidas.
  if not exists (
    select 1 from status_transicoes_validas
    where status_origem = old.status and status_destino = new.status
  ) then
    raise exception 'Transição de status inválida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- Regras de negócio específicas de cada transição -------------------------

  if new.status = 'REJEITADO' then
    if new.motivo_rejeicao is null or btrim(new.motivo_rejeicao) = '' then
      raise exception 'motivo_rejeicao é obrigatório ao rejeitar um chamado';
    end if;
    new.rejeitado_em := now();
  end if;

  if new.status = 'EM_COMPRAS' then
    -- Aprovação do admin: gera o número público do chamado.
    if new.numero_chamado is null then
      new.numero_chamado := gerar_numero_chamado();
    end if;
    new.aprovado_em := now();
    new.em_compras_em := now();
  end if;

  if new.status = 'AGUARDANDO_EXECUCAO' then
    -- Se compras optou por pular a compra de material, exige justificativa.
    -- (a aplicação decide se houve compra real checando chamado_anexos)
    if new.observacao_compras is not null and btrim(new.observacao_compras) = '' then
      raise exception 'observacao_compras não pode ser vazia quando informada';
    end if;
    new.aguardando_execucao_em := now();
  end if;

  if new.status = 'EM_ANDAMENTO' then
    if new.artifice_id is null then
      raise exception 'artifice_id é obrigatório para iniciar a execução do chamado';
    end if;
    new.em_andamento_em := now();
  end if;

  if new.status = 'FINALIZADO' then
    new.finalizado_em := now();
  end if;

  if new.status = 'CANCELADO' then
    new.cancelado_em := now();
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_validar_transicao_chamado
  before update on chamados
  for each row
  execute function validar_transicao_chamado();

-- -----------------------------------------------------------------------------
-- Trigger de auditoria: registra toda transição de status em
-- chamado_historico automaticamente (INSERT inicial e cada UPDATE de status).
-- -----------------------------------------------------------------------------
create or replace function registrar_historico_chamado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into chamado_historico (chamado_id, status_anterior, status_novo, observacao)
    values (new.id, null, new.status, 'Chamado criado pelo morador');
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into chamado_historico (chamado_id, status_anterior, status_novo, observacao, usuario_id)
    values (
      new.id,
      old.status,
      new.status,
      coalesce(new.motivo_rejeicao, new.observacao_compras),
      coalesce(new.aprovado_por, new.compras_por, new.artifice_id)
    );
  end if;

  return new;
end;
$$;

create trigger trg_registrar_historico_insert
  after insert on chamados
  for each row
  execute function registrar_historico_chamado();

create trigger trg_registrar_historico_update
  after update on chamados
  for each row
  execute function registrar_historico_chamado();
