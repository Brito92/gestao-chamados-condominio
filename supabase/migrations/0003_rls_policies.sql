-- =============================================================================
-- 0003_rls_policies.sql
-- Row Level Security para o MVP.
--
-- IMPORTANTE (ler antes de ir para produção):
-- Como este MVP foi pedido explicitamente SEM login, as policies abaixo são
-- permissivas por padrão: qualquer requisição feita com a chave `anon` do
-- Supabase consegue ler/escrever nas tabelas necessárias para o fluxo
-- funcionar (morador abre chamado, admin/compras/artífice operam sem auth).
--
-- Quando o login for implementado (Supabase Auth), o caminho recomendado é:
--   1. Vincular `usuarios.auth_user_id` ao `auth.uid()`.
--   2. Trocar as policies "true" abaixo por checagens de papel, ex:
--        using (exists (
--          select 1 from usuarios u
--          where u.auth_user_id = auth.uid() and u.papel = 'ADMIN'
--        ))
--   3. Restringir INSERT em `usuarios` somente a quem tem papel ADMIN.
-- =============================================================================

alter table condominios enable row level security;
alter table usuarios enable row level security;
alter table chamados enable row level security;
alter table chamado_anexos enable row level security;
alter table chamado_historico enable row level security;
alter table status_transicoes_validas enable row level security;

-- condominios: leitura pública (necessária para o formulário do morador)
create policy "condominios_select_publico" on condominios
  for select using (true);

create policy "condominios_insert_publico_mvp" on condominios
  for insert with check (true);

create policy "condominios_update_publico_mvp" on condominios
  for update using (true);

-- usuarios: leitura e escrita liberadas no MVP (sem login).
-- Em produção, restringir INSERT/UPDATE/DELETE ao papel ADMIN.
create policy "usuarios_select_publico_mvp" on usuarios
  for select using (true);

create policy "usuarios_insert_publico_mvp" on usuarios
  for insert with check (true);

create policy "usuarios_update_publico_mvp" on usuarios
  for update using (true);

-- chamados: o morador precisa conseguir INSERIR (abrir chamado) e
-- CONSULTAR pelo número, sem autenticação. Admin/compras/artífice também
-- operam sem login neste MVP, então SELECT/UPDATE ficam abertos.
create policy "chamados_select_publico" on chamados
  for select using (true);

create policy "chamados_insert_publico" on chamados
  for insert with check (true);

create policy "chamados_update_publico_mvp" on chamados
  for update using (true);

-- chamado_anexos: upload e leitura liberados (morador anexa foto do
-- problema sem login; equipe interna anexa orçamentos/fotos de execução).
create policy "chamado_anexos_select_publico" on chamado_anexos
  for select using (true);

create policy "chamado_anexos_insert_publico" on chamado_anexos
  for insert with check (true);

-- chamado_historico: somente leitura pela aplicação (é preenchido por
-- trigger). Ninguém deve inserir manualmente.
create policy "chamado_historico_select_publico" on chamado_historico
  for select using (true);

-- status_transicoes_validas: tabela de referência, leitura pública.
create policy "status_transicoes_select_publico" on status_transicoes_validas
  for select using (true);

-- -----------------------------------------------------------------------------
-- Storage: bucket público para anexos dos chamados (fotos, orçamentos, etc.)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chamados-anexos', 'chamados-anexos', true)
on conflict (id) do nothing;

create policy "chamados_anexos_storage_select" on storage.objects
  for select using (bucket_id = 'chamados-anexos');

create policy "chamados_anexos_storage_insert" on storage.objects
  for insert with check (bucket_id = 'chamados-anexos');
