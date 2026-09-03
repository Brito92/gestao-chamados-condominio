-- 0016_novos_status_fluxo.sql
-- Adiciona estados que distinguem envio, assunção, pendência e não execução.

alter type status_chamado add value if not exists 'ENVIADO_PARA_COMPRAS';
alter type status_chamado add value if not exists 'ENVIADO_PARA_EXECUCAO';
alter type status_chamado add value if not exists 'PENDENTE';
alter type status_chamado add value if not exists 'NAO_EXECUTADO';
