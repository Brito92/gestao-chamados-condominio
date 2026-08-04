-- =============================================================================
-- 0001_schema_base.sql
-- Sistema de Gestão de Chamados e Manutenção de Condomínios
-- Schema base: extensões, enums e tabelas principais
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

-- Papéis internos do sistema. MORADOR não é um papel de usuário autenticado:
-- o morador nunca faz login, apenas preenche o formulário público.
create type papel_usuario as enum ('ADMIN', 'COMPRAS', 'ARTIFICE');

-- Tipo do problema relatado pelo morador.
create type tipo_problema as enum ('ELETRICA', 'HIDRAULICA', 'REFORMA', 'OUTROS');

-- Estados possíveis do ciclo de vida de um chamado (state machine).
-- A ordem "feliz" do fluxo é:
--   EM_ANALISE -> EM_COMPRAS -> AGUARDANDO_EXECUCAO -> EM_ANDAMENTO -> FINALIZADO
-- Estados terminais alternativos: REJEITADO, CANCELADO.
create type status_chamado as enum (
  'EM_ANALISE',
  'REJEITADO',
  'EM_COMPRAS',
  'AGUARDANDO_EXECUCAO',
  'EM_ANDAMENTO',
  'FINALIZADO',
  'CANCELADO'
);

-- Tipos de anexo suportados, usados para diferenciar a etapa do chamado
-- em que o arquivo foi enviado (mostrado na timeline do chamado).
create type tipo_anexo as enum (
  'FOTO_SOLICITACAO',   -- foto enviada pelo morador ao abrir o chamado
  'ANEXO_REJEICAO',     -- anexo do admin ao rejeitar a solicitação
  'ORCAMENTO',          -- orçamento anexado pelo setor de compras
  'COMPROVANTE_COMPRA', -- nota fiscal / comprovante de compra
  'FOTO_ANTES',         -- foto do artífice antes da execução
  'FOTO_DEPOIS'         -- foto do artífice após a conclusão
);

-- -----------------------------------------------------------------------------
-- TABELA: condominios
-- Suporta múltiplos condomínios desde o início, ainda que o MVP opere com um.
-- -----------------------------------------------------------------------------
create table condominios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  endereco    text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

comment on table condominios is 'Condomínios atendidos pelo sistema.';

-- -----------------------------------------------------------------------------
-- TABELA: usuarios
-- Usuários internos (ADMIN, COMPRAS, ARTIFICE). Somente o ADMIN pode criar
-- novos usuários - não existe autocadastro. Neste MVP não há autenticação
-- (login) real; o campo auth_user_id fica pronto para, no futuro, ser
-- vinculado ao Supabase Auth (auth.users) sem precisar remodelar o schema.
-- -----------------------------------------------------------------------------
create table usuarios (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique, -- preenchido futuramente quando o login for habilitado
  nome           text not null,
  email          text not null unique,
  whatsapp       text,
  papel          papel_usuario not null,
  condominio_id  uuid references condominios(id) on delete set null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references usuarios(id) on delete set null
);

comment on table usuarios is 'Usuários internos do sistema (admin, compras, artífice). Criados exclusivamente pelo admin.';

-- -----------------------------------------------------------------------------
-- TABELA: chamados
-- Núcleo do sistema. O morador não é um usuário: seus dados de contato
-- ficam armazenados diretamente no chamado.
-- -----------------------------------------------------------------------------
create table chamados (
  id                    uuid primary key default gen_random_uuid(),

  -- número de chamado amigável, gerado somente quando o admin APROVA a
  -- solicitação (transição EM_ANALISE -> EM_COMPRAS). Antes disso é nulo,
  -- pois o morador ainda não deve ter um número para consultar.
  numero_chamado        text unique,

  condominio_id         uuid not null references condominios(id) on delete restrict,

  -- Dados do morador (sem necessidade de conta/login)
  morador_nome          text not null,
  morador_whatsapp      text not null,
  local_problema        text not null,
  tipo_problema         tipo_problema not null default 'OUTROS',
  descricao             text not null,

  -- Estado atual do chamado
  status                status_chamado not null default 'EM_ANALISE',

  -- Motivo obrigatório quando o admin rejeita a solicitação
  motivo_rejeicao       text,

  -- Observação obrigatória quando compras pula a etapa de compra de material
  observacao_compras    text,

  -- Responsáveis atribuídos em cada etapa
  aprovado_por          uuid references usuarios(id) on delete set null,
  compras_por           uuid references usuarios(id) on delete set null,
  artifice_id           uuid references usuarios(id) on delete set null,

  -- Datas de controle de SLA
  criado_em             timestamptz not null default now(),
  aprovado_em           timestamptz,
  em_compras_em         timestamptz,
  aguardando_execucao_em timestamptz,
  em_andamento_em       timestamptz,
  finalizado_em         timestamptz,
  cancelado_em          timestamptz,
  rejeitado_em          timestamptz,
  atualizado_em         timestamptz not null default now()
);

comment on table chamados is 'Chamados de manutenção abertos pelos moradores e acompanhados até a conclusão.';
comment on column chamados.numero_chamado is 'Gerado apenas na aprovação do admin; é o código que o morador usa para consultar o status.';

-- -----------------------------------------------------------------------------
-- TABELA: chamado_anexos
-- Fotos e documentos anexados em qualquer etapa do chamado.
-- -----------------------------------------------------------------------------
create table chamado_anexos (
  id           uuid primary key default gen_random_uuid(),
  chamado_id   uuid not null references chamados(id) on delete cascade,
  tipo         tipo_anexo not null,
  url          text not null,
  descricao    text,
  -- Preenchido opcionalmente quando tipo = ORCAMENTO/COMPROVANTE_COMPRA,
  -- para alimentar o relatório de gastos do admin/síndico.
  valor        numeric(12, 2),
  enviado_por  uuid references usuarios(id) on delete set null, -- nulo quando enviado pelo morador
  criado_em    timestamptz not null default now()
);

comment on table chamado_anexos is 'Arquivos (fotos, orçamentos, comprovantes) vinculados a um chamado.';

-- -----------------------------------------------------------------------------
-- TABELA: chamado_historico
-- Trilha de auditoria imutável de todas as transições de status.
-- Preenchida automaticamente por trigger (ver 0002_state_machine.sql).
-- -----------------------------------------------------------------------------
create table chamado_historico (
  id               uuid primary key default gen_random_uuid(),
  chamado_id       uuid not null references chamados(id) on delete cascade,
  status_anterior  status_chamado,
  status_novo      status_chamado not null,
  observacao       text,
  usuario_id       uuid references usuarios(id) on delete set null,
  criado_em        timestamptz not null default now()
);

comment on table chamado_historico is 'Auditoria imutável de cada transição de status pela qual o chamado passou.';

-- -----------------------------------------------------------------------------
-- Índices de apoio às consultas mais comuns
-- -----------------------------------------------------------------------------
create index idx_chamados_status on chamados (status);
create index idx_chamados_condominio on chamados (condominio_id);
create index idx_chamados_numero on chamados (numero_chamado);
create index idx_chamados_artifice on chamados (artifice_id);
create index idx_chamado_anexos_chamado on chamado_anexos (chamado_id);
create index idx_chamado_historico_chamado on chamado_historico (chamado_id);
create index idx_usuarios_papel on usuarios (papel);
