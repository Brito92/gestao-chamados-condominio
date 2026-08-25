-- Correções de permissões, auditoria e execução.

create or replace function meu_admin_master()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from usuarios
    where auth_user_id = auth.uid()
      and ativo = true
      and papel = 'ADMIN'
      and admin_master = true
  );
$$;

create or replace function pode_editar_usuario(usuario_alvo uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select meu_admin_master()
    or exists (
      select 1
      from usuarios alvo
      where alvo.id = usuario_alvo
        and (alvo.papel <> 'ADMIN' or alvo.id = meu_usuario_id())
    );
$$;

-- Admin comum pode operar Compras/Artífice e o próprio cadastro, mas nunca
-- editar ou desativar outro administrador.
drop policy if exists "usuarios_select_proprio_ou_admin" on usuarios;
drop policy if exists "usuarios_insert_admin" on usuarios;
drop policy if exists "usuarios_update_admin" on usuarios;

create policy "usuarios_select_equipe_interna" on usuarios
  for select using (meu_papel() is not null);

create policy "usuarios_insert_admin" on usuarios
  for insert
  with check (
    meu_papel() = 'ADMIN'
    and (meu_admin_master() or papel in ('COMPRAS', 'ARTIFICE'))
  );

create policy "usuarios_update_admin" on usuarios
  for update
  using (meu_papel() = 'ADMIN' and pode_editar_usuario(id))
  with check (
    meu_papel() = 'ADMIN'
    and (meu_admin_master() or papel <> 'ADMIN' or id = meu_usuario_id())
  );

-- A política de INSERT/UPDATE não libera exclusão acidental; a exclusão de
-- condomínio é explícita e continua protegida pelas FKs dos chamados.
create policy "condominios_delete_admin" on condominios
  for delete using (meu_papel() = 'ADMIN');

-- Somente Compras precisa consultar a equipe de artífices para atribuição;
-- a política acima também permite que o histórico mostre os responsáveis
-- para qualquer membro autenticado da equipe.

drop policy if exists "chamados_update_artifice" on chamados;
create policy "chamados_update_artifice" on chamados
  for update
  using (
    meu_papel() = 'ARTIFICE'
    and status in ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO')
    and (artifice_id is null or artifice_id = meu_usuario_id())
  )
  with check (meu_papel() = 'ARTIFICE');

-- Garante que registros antigos sem valor não sejam tratados como
-- "não executados" pelo frontend.
update chamados set executado = true where executado is null;
alter table chamados alter column executado set default true;
alter table chamados alter column executado set not null;

-- A observação do histórico deve pertencer à etapa que acabou de acontecer.
-- Antes, coalesce() sempre encontrava a observação do admin e a repetia nas
-- etapas seguintes. Também registramos atribuições e novas observações sem
-- sobrescrever o texto das outras etapas.
create or replace function registrar_historico_chamado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  observacao_atual text;
  responsavel uuid;
begin
  if tg_op = 'INSERT' then
    insert into chamado_historico (chamado_id, status_anterior, status_novo, observacao, usuario_id)
    values (new.id, null, new.status, 'Chamado criado pelo morador', meu_usuario_id());
    return new;
  end if;

  if new.status is distinct from old.status then
    observacao_atual := case new.status
      when 'REJEITADO' then new.motivo_rejeicao
      when 'EM_COMPRAS' then new.observacao_aprovacao
      when 'AGUARDANDO_EXECUCAO' then new.observacao_compras
      when 'EM_ANDAMENTO' then new.observacao_artifice
      when 'FINALIZADO' then case when new.executado = false then new.motivo_nao_execucao else new.observacao_artifice end
      else null
    end;
    responsavel := coalesce(meu_usuario_id(),
      case new.status
        when 'EM_COMPRAS' then new.aprovado_por
        when 'AGUARDANDO_EXECUCAO' then new.compras_por
        when 'EM_ANDAMENTO' then new.artifice_id
        when 'FINALIZADO' then new.artifice_id
        else null
      end);

    insert into chamado_historico (chamado_id, status_anterior, status_novo, observacao, usuario_id)
    values (new.id, old.status, new.status, observacao_atual, responsavel);
  elsif new.artifice_id is distinct from old.artifice_id
     or new.observacao_artifice is distinct from old.observacao_artifice
     or new.motivo_nao_execucao is distinct from old.motivo_nao_execucao then
    observacao_atual := coalesce(
      case when new.motivo_nao_execucao is distinct from old.motivo_nao_execucao then new.motivo_nao_execucao end,
      case when new.observacao_artifice is distinct from old.observacao_artifice then new.observacao_artifice end,
      case when new.artifice_id is distinct from old.artifice_id then 'Artífice responsável atualizado.' end
    );
    insert into chamado_historico (chamado_id, status_anterior, status_novo, observacao, usuario_id)
    values (new.id, old.status, new.status, observacao_atual, meu_usuario_id());
  end if;

  return new;
end;
$$;
