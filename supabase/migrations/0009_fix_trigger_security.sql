-- =============================================================================
-- 0009_fix_trigger_security.sql
-- Corrige SECURITY DEFINER na função registrar_historico_chamado
-- A migration 0007 removeu acidentalmente o SECURITY DEFINER, causando erro 403
-- =============================================================================

alter function registrar_historico_chamado() security definer;
alter function registrar_historico_chamado() set search_path = public;
