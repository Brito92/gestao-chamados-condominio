-- =============================================================================
-- 0011_rls_policies.sql (migrated from 0003_rls_policies.sql to avoid duplicate version)
-- Row Level Security para o MVP.
-- =============================================================================

alter table condominios enable row level security;
alter table usuarios enable row level security;
alter table chamados enable row level security;
alter table chamado_anexos enable row level security;
alter table chamado_historico enable row level security;
alter table status_transicoes_validas enable row level security;

-- condominios: leitura pública (necessária para o formulário do morador)
drop policy if exists "condominios_select_publico" on condominios;
create policy "condominios_select_publico" on condominios
  for select using (true);

drop policy if exists "condominios_insert_publico_mvp" on condominios;
create policy "condominios_insert_publico_mvp" on condominios
  for insert with check (true);

drop policy if exists "condominios_update_publico_mvp" on condominios;
create policy "condominios_update_publico_mvp" on condominios
  for update using (true);

-- usuarios: leitura e escrita liberadas no MVP (sem login).
drop policy if exists "usuarios_select_publico_mvp" on usuarios;
create policy "usuarios_select_publico_mvp" on usuarios
  for select using (true);

drop policy if exists "usuarios_insert_publico_mvp" on usuarios;
create policy "usuarios_insert_publico_mvp" on usuarios
  for insert with check (true);

drop policy if exists "usuarios_update_publico_mvp" on usuarios;
create policy "usuarios_update_publico_mvp" on usuarios
  for update using (true);

-- chamados
drop policy if exists "chamados_select_publico" on chamados;
create policy "chamados_select_publico" on chamados
  for select using (true);

drop policy if exists "chamados_insert_publico" on chamados;
create policy "chamados_insert_publico" on chamados
  for insert with check (true);

drop policy if exists "chamados_update_publico_mvp" on chamados;
create policy "chamados_update_publico_mvp" on chamados
  for update using (true);

-- chamado_anexos
drop policy if exists "chamado_anexos_select_publico" on chamado_anexos;
create policy "chamado_anexos_select_publico" on chamado_anexos
  for select using (true);

drop policy if exists "chamado_anexos_insert_publico" on chamado_anexos;
create policy "chamado_anexos_insert_publico" on chamado_anexos
  for insert with check (true);

-- chamado_historico
drop policy if exists "chamado_historico_select_publico" on chamado_historico;
create policy "chamado_historico_select_publico" on chamado_historico
  for select using (true);

-- status_transicoes_validas
drop policy if exists "status_transicoes_select_publico" on status_transicoes_validas;
create policy "status_transicoes_select_publico" on status_transicoes_validas
  for select using (true);

-- Storage
insert into storage.buckets (id, name, public)
values ('chamados-anexos', 'chamados-anexos', true)
on conflict (id) do nothing;

drop policy if exists "chamados_anexos_storage_select" on storage.objects;
create policy "chamados_anexos_storage_select" on storage.objects
  for select using (bucket_id = 'chamados-anexos');

drop policy if exists "chamados_anexos_storage_insert" on storage.objects;
create policy "chamados_anexos_storage_insert" on storage.objects
  for insert with check (bucket_id = 'chamados-anexos');
