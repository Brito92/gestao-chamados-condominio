-- =============================================================================
-- 0006_observacao_aprovacao.sql
-- Adiciona campo de observação opcional na aprovação do admin
-- =============================================================================

alter table chamados
  add column observacao_aprovacao text;

comment on column chamados.observacao_aprovacao is 
  'Observação opcional do admin ao aprovar a solicitação, visível nas próximas etapas (compras, artífice).';
