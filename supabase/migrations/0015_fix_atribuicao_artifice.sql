-- =============================================================================
-- 0015_fix_atribuicao_artifice.sql
-- Impede que um artifice sobrescreva a atribuicao de outro e inicia a execucao
-- com lock/validacao atomicos no banco.
-- Depende da migration 0013_auditoria_fluxo_concorrencia.sql.
-- =============================================================================

-- A policy precisa validar tambem a nova atribuicao. O USING protege a linha
-- antiga; o WITH CHECK protege os valores gravados na linha nova.
drop policy if exists "chamados_update_artifice" on chamados;
create policy "chamados_update_artifice" on chamados
  for update using (
    meu_papel() = 'ARTIFICE'
    and assumido_por = meu_usuario_id()
    and status in ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO')
    and (artifice_id is null or artifice_id = meu_usuario_id())
  ) with check (
    meu_papel() = 'ARTIFICE'
    and assumido_por = meu_usuario_id()
    and (artifice_id is null or artifice_id = meu_usuario_id())
  );

-- Defesa adicional para chamadas diretas a UPDATE. O artifice pode assumir um
-- chamado sem atribuicao, mas nunca trocar o artifice de uma linha ja vinculada.
create or replace function proteger_atribuicao_artifice()
returns trigger
language plpgsql
as $$
declare
  eu uuid := meu_usuario_id();
begin
  if meu_papel() = 'ARTIFICE' and new.assumido_por is not null then
    if new.artifice_id is not null and new.artifice_id <> eu then
      raise exception 'Um artifice nao pode atribuir o chamado a outro artifice';
    end if;

    if old.assumido_por is not null
       and old.artifice_id is not null
       and new.artifice_id is distinct from old.artifice_id then
      raise exception 'A atribuicao deste chamado nao pode ser sobrescrita';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_atribuicao_artifice on chamados;
create trigger trg_proteger_atribuicao_artifice
  before update on chamados
  for each row
  execute function proteger_atribuicao_artifice();

-- Inicia a execucao somente para quem possui o lock vigente. O FOR UPDATE
-- elimina a corrida entre dois cliques simultaneos e a atribuicao sempre fica
-- vinculada ao usuario autenticado atual.
create or replace function iniciar_execucao_artifice(p_chamado_id uuid)
returns chamados
language plpgsql
security definer
set search_path = public
as $$
declare
  registro chamados;
  eu uuid := meu_usuario_id();
begin
  if eu is null or meu_papel() <> 'ARTIFICE' then
    raise exception 'Somente artifice pode iniciar a execucao';
  end if;

  select * into registro
  from chamados
  where id = p_chamado_id
  for update;

  if registro.id is null then
    raise exception 'Chamado nao encontrado';
  end if;
  if registro.status <> 'AGUARDANDO_EXECUCAO' then
    raise exception 'Este chamado nao esta aguardando execucao';
  end if;
  if registro.assumido_por <> eu
     or registro.bloqueio_expira_em is null
     or registro.bloqueio_expira_em <= now() then
    raise exception 'Assuma o chamado antes de iniciar a execucao';
  end if;
  if registro.artifice_id is not null and registro.artifice_id <> eu then
    raise exception 'Este chamado foi atribuido a outro artifice';
  end if;

  update chamados
  set status = 'EM_ANDAMENTO',
      artifice_id = eu,
      artifice_atribuido_por = coalesce(artifice_atribuido_por, eu),
      artifice_atribuido_em = coalesce(artifice_atribuido_em, now())
  where id = p_chamado_id;

  select * into registro from chamados where id = p_chamado_id;
  return registro;
end;
$$;

revoke all on function iniciar_execucao_artifice(uuid) from public;
grant execute on function iniciar_execucao_artifice(uuid) to authenticated;

