-- =============================================================================
-- 0004_seed.sql
-- Dados iniciais para permitir os testes de funcionalidade imediatamente
-- após rodar as migrations: um condomínio, um admin provisório e um
-- usuário de cada papel (compras e artífice) para você já ver o fluxo
-- completo funcionando.
-- =============================================================================

insert into condominios (id, nome, endereco)
values ('00000000-0000-0000-0000-000000000001', 'Condomínio Residencial Jequitibá', 'Av. das Palmeiras, 500 - Manaus/AM')
on conflict (id) do nothing;

-- Admin provisório: use este usuário para logar (quando o login existir) e,
-- por enquanto, ele já aparece pré-selecionado no seletor de perfil do MVP.
-- Marcado como admin_master (síndico principal) para poder gerenciar outros admins.
insert into usuarios (id, nome, email, whatsapp, papel, condominio_id, ativo, admin_master)
values
  ('00000000-0000-0000-0000-000000000010', 'Admin Provisório', 'admin@condominio.dev', '92999990000', 'ADMIN', '00000000-0000-0000-0000-000000000001', true, true)
on conflict (id) do nothing;

insert into usuarios (id, nome, email, whatsapp, papel, condominio_id, ativo, criado_por)
values
  ('00000000-0000-0000-0000-000000000011', 'Compras - Fernanda Lima', 'compras@condominio.dev', '92999990001', 'COMPRAS', '00000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000012', 'Artífice - João Torres', 'artifice@condominio.dev', '92999990002', 'ARTIFICE', '00000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000010')
on conflict (id) do nothing;

-- Um chamado de exemplo já em EM_ANALISE para você visualizar a fila do
-- admin assim que abrir o sistema pela primeira vez.
insert into chamados (
  id, condominio_id, morador_nome, morador_whatsapp, local_problema,
  tipo_problema, descricao, status
) values (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000001',
  'Maria Souza',
  '92988887777',
  'Bloco B - Apto 302',
  'HIDRAULICA',
  'Vazamento no registro do chuveiro, água acumulando no banheiro.',
  'EM_ANALISE'
) on conflict (id) do nothing;
