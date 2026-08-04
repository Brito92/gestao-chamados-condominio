-- =============================================================================
-- 0008_fix_rls_policies.sql
-- Garante que as políticas RLS para chamados estejam corretas
-- =============================================================================

-- Remove políticas existentes para evitar conflitos
drop policy if exists "chamados_update_admin" on chamados;
drop policy if exists "chamados_update_compras" on chamados;
drop policy if exists "chamados_update_artifice" on chamados;

-- Recria as políticas de UPDATE para chamados
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
