-- =============================================================================
-- 0007_atualiza_trigger_historico.sql
-- Atualiza trigger de histórico para registrar observação de aprovação
-- IMPORTANTE: Execute primeiro a migration 0006_observacao_aprovacao.sql
-- =============================================================================

create or replace function registrar_historico_chamado()
returns trigger
language plpgsql
security definer
set search_path = public
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
      coalesce(new.motivo_rejeicao, new.observacao_compras, new.observacao_aprovacao),
      coalesce(new.aprovado_por, new.compras_por, new.artifice_id)
    );
  end if;

  return new;
end;
$$;

-- Recria os triggers para garantir que usem a função atualizada
drop trigger if exists trg_registrar_historico_insert on chamados;
drop trigger if exists trg_registrar_historico_update on chamados;

create trigger trg_registrar_historico_insert
  after insert on chamados
  for each row
  execute function registrar_historico_chamado();

create trigger trg_registrar_historico_update
  after update on chamados
  for each row
  execute function registrar_historico_chamado();
