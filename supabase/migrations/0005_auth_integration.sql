-- =============================================================================
-- 0005_auth_integration.sql
-- Introduz login real (Supabase Auth) para ADMIN / COMPRAS / ARTIFICE e
-- substitui as policies permissivas do MVP por controle de acesso por papel.
--
-- Fluxo de criação de conta (sem autocadastro livre):
--   1. O admin cadastra o usuário em `usuarios` (nome, e-mail, papel) - como
--      já acontecia antes, via tela "Equipe interna".
--   2. A própria pessoa acessa a tela de login e escolhe "Primeiro acesso",
--      informando o MESMO e-mail e uma senha à sua escolha
--      (supabase.auth.signUp).
--   3. O trigger `on_auth_user_created` abaixo só permite essa criação de
--      conta se o e-mail já existir em `usuarios` (cadastrado pelo admin) e
--      ainda não estiver vinculado a nenhuma conta; caso contrário, a
--      criação da conta é rejeitada.
--   4. Quando aprovado, o trigger vincula `usuarios.auth_user_id` ao novo
--      `auth.users.id` automaticamente.
--
-- O morador continua sem nenhuma exigência de login (não é afetado por
-- esta migration).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções auxiliares para as policies de RLS.
--
-- São SECURITY DEFINER de propósito: permitem consultar `usuarios` a partir
-- de dentro de uma policy da própria tabela `usuarios` sem cair em recursão
-- de RLS (a policy chama a função, a função - rodando com o dono/privilégio
-- elevado - lê a tabela ignorando RLS, e devolve só o papel/linha do usuário
-- autenticado atual).
-- -----------------------------------------------------------------------------
create or replace function meu_papel()
returns papel_usuario
language sql
security definer
set search_path = public
stable
as $$
  select papel from usuarios where auth_user_id = auth.uid() and ativo = true limit 1;
$$;

comment on function meu_papel() is 'Papel (ADMIN/COMPRAS/ARTIFICE) do usuário autenticado atual, ou null se não houver sessão/usuário vinculado.';

create or replace function meu_usuario_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from usuarios where auth_user_id = auth.uid() and ativo = true limit 1;
$$;

comment on function meu_usuario_id() is 'Id em usuarios do usuário autenticado atual.';

-- -----------------------------------------------------------------------------
-- Trigger: só permite criar conta (auth.users) para e-mails já cadastrados
-- pelo admin em `usuarios`, e faz o vínculo automaticamente.
-- -----------------------------------------------------------------------------
create or replace function public.handle_novo_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario_encontrado usuarios;
begin
  select * into usuario_encontrado
  from usuarios
  where email = new.email
    and ativo = true
    and auth_user_id is null
  limit 1;

  if usuario_encontrado.id is null then
    raise exception
      'Este e-mail não foi cadastrado por um administrador. Peça ao síndico para te cadastrar em "Equipe interna" antes de criar sua senha.';
  end if;

  update usuarios set auth_user_id = new.id where id = usuario_encontrado.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_novo_auth_user();

-- -----------------------------------------------------------------------------
-- Corrige um problema de RLS pré-existente: o trigger de auditoria
-- (`registrar_historico_chamado`) insere em `chamado_historico`, mas essa
-- tabela nunca teve policy de INSERT (só SELECT) - o que faria o trigger
-- falhar silenciosamente sob RLS. Marcamos a função como SECURITY DEFINER
-- para que a inserção de auditoria sempre funcione, independentemente de
-- quem disparou o UPDATE/INSERT em `chamados`.
-- -----------------------------------------------------------------------------
alter function registrar_historico_chamado() security definer;
alter function registrar_historico_chamado() set search_path = public;

-- -----------------------------------------------------------------------------
-- Remove as policies permissivas do MVP sem login.
-- -----------------------------------------------------------------------------
drop policy if exists "condominios_insert_publico_mvp" on condominios;
drop policy if exists "condominios_update_publico_mvp" on condominios;
drop policy if exists "usuarios_select_publico_mvp" on usuarios;
drop policy if exists "usuarios_insert_publico_mvp" on usuarios;
drop policy if exists "usuarios_update_publico_mvp" on usuarios;
drop policy if exists "chamados_update_publico_mvp" on chamados;

-- -----------------------------------------------------------------------------
-- condominios: consulta pública continua liberada (necessária para o
-- formulário do morador); escrita agora exclusiva do admin.
-- -----------------------------------------------------------------------------
create policy "condominios_insert_admin" on condominios
  for insert with check (meu_papel() = 'ADMIN');

create policy "condominios_update_admin" on condominios
  for update using (meu_papel() = 'ADMIN');

-- -----------------------------------------------------------------------------
-- usuarios: qualquer pessoa da equipe autenticada pode ver a própria linha;
-- somente ADMIN vê/gerencia a lista completa (tela "Equipe interna").
-- Autocadastro nunca é permitido via API - só o admin cria a linha inicial.
-- -----------------------------------------------------------------------------
create policy "usuarios_select_proprio_ou_admin" on usuarios
  for select using (auth_user_id = auth.uid() or meu_papel() = 'ADMIN');

create policy "usuarios_insert_admin" on usuarios
  for insert with check (meu_papel() = 'ADMIN');

create policy "usuarios_update_admin" on usuarios
  for update using (meu_papel() = 'ADMIN');

-- -----------------------------------------------------------------------------
-- chamados: atualização de status agora exige login e respeita quem pode
-- mexer em qual etapa. A validação fina de qual transição é permitida
-- continua sendo feita pelo trigger da state machine (0002); aqui
-- restringimos apenas QUEM pode tentar uma atualização em cada etapa.
-- -----------------------------------------------------------------------------
create policy "chamados_update_admin" on chamados
  for update
  using (meu_papel() = 'ADMIN')
  with check (meu_papel() = 'ADMIN');

create policy "chamados_update_compras" on chamados
  for update
  using (meu_papel() = 'COMPRAS' and status = 'EM_COMPRAS')
  with check (meu_papel() = 'COMPRAS');

create policy "chamados_update_artifice" on chamados
  for update
  using (meu_papel() = 'ARTIFICE' and status in ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO'))
  with check (meu_papel() = 'ARTIFICE');
