-- Auditoria detalhada de alterações sensíveis e eventos de autenticação.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete set null,
  acao varchar(50) not null,
  tabela varchar(100),
  registro_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  ip_address inet,
  user_agent text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_audit_log_criado_em on audit_log (criado_em desc);
create index if not exists idx_audit_log_usuario on audit_log (usuario_id, criado_em desc);
create index if not exists idx_audit_log_registro on audit_log (tabela, registro_id, criado_em desc);

alter table audit_log enable row level security;
revoke all on table audit_log from anon, authenticated;
grant select on table audit_log to authenticated;
drop policy if exists "audit_log_select_admin" on audit_log;
create policy "audit_log_select_admin" on audit_log
  for select using (meu_papel() = 'ADMIN');

create or replace function log_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  registro_id_atual uuid;
  dados_antes_atual jsonb;
  dados_depois_atual jsonb;
begin
  if tg_op = 'INSERT' then
    registro_id_atual := new.id;
    dados_depois_atual := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    registro_id_atual := new.id;
    dados_antes_atual := to_jsonb(old);
    dados_depois_atual := to_jsonb(new);
  else
    registro_id_atual := old.id;
    dados_antes_atual := to_jsonb(old);
  end if;

  insert into audit_log (
    usuario_id, acao, tabela, registro_id,
    dados_antes, dados_depois, criado_em
  ) values (
    meu_usuario_id(), tg_op, tg_table_name, registro_id_atual,
    dados_antes_atual, dados_depois_atual, now()
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function log_auditoria() from public;

drop trigger if exists audit_chamados on chamados;
create trigger audit_chamados
  after insert or update or delete on chamados
  for each row execute function log_auditoria();

drop trigger if exists audit_usuarios on usuarios;
create trigger audit_usuarios
  after insert or update or delete on usuarios
  for each row execute function log_auditoria();

drop trigger if exists audit_condominios on condominios;
create trigger audit_condominios
  after insert or update or delete on condominios
  for each row execute function log_auditoria();

drop trigger if exists audit_chamado_anexos on chamado_anexos;
create trigger audit_chamado_anexos
  after insert or update or delete on chamado_anexos
  for each row execute function log_auditoria();

create or replace function registrar_evento_auditoria(
  p_acao varchar(50),
  p_tabela varchar(100) default null,
  p_registro_id uuid default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_acao not in ('LOGIN', 'LOGOUT', 'SELECT', 'EXPORT') then
    raise exception 'Ação de auditoria inválida';
  end if;

  insert into audit_log (
    usuario_id, acao, tabela, registro_id, user_agent
  ) values (
    meu_usuario_id(), p_acao, p_tabela, p_registro_id, left(p_user_agent, 1000)
  );
end;
$$;

revoke all on function registrar_evento_auditoria(varchar, varchar, uuid, text) from public;
grant execute on function registrar_evento_auditoria(varchar, varchar, uuid, text) to authenticated;

do $$
begin
  if to_regclass('public.solicitacao_mensagens') is not null then
    execute 'drop trigger if exists audit_solicitacao_mensagens on solicitacao_mensagens';
    execute 'create trigger audit_solicitacao_mensagens after insert or update or delete on solicitacao_mensagens for each row execute function log_auditoria()';
  end if;
end $$;
