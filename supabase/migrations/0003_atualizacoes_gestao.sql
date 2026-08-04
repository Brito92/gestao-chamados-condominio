-- =============================================================================
-- 0003_atualizacoes_gestao.sql
-- Hierarquia de admins (master x comum), atribuição prévia de artífice,
-- chat da solicitação (síndico <-> morador) e observações do artífice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Hierarquia de administradores: admin_master (síndico principal) x admin
-- comum. Só faz sentido para papel = 'ADMIN'; para os demais fica sempre false.
-- -----------------------------------------------------------------------------
alter table usuarios
  add column admin_master boolean not null default false;

comment on column usuarios.admin_master is
  'Somente para papel ADMIN: true = síndico principal (pode gerenciar outros admins), false = admin comum (não pode criar/editar/desativar admins).';

-- Garante que o primeiro admin cadastrado no sistema já nasça como master,
-- para nunca ficar sem nenhum admin master (idempotente).
update usuarios set admin_master = true
where papel = 'ADMIN'
  and admin_master = false
  and not exists (select 1 from usuarios u2 where u2.papel = 'ADMIN' and u2.admin_master = true)
  and id = (
    select id from usuarios where papel = 'ADMIN' order by criado_em asc limit 1
  );

-- -----------------------------------------------------------------------------
-- Atribuição prévia/posterior de artífice: registra quem atribuiu e quando,
-- podendo ser feita pelo admin (na aprovação) ou por compras (na liberação).
-- -----------------------------------------------------------------------------
alter table chamados
  add column artifice_atribuido_por uuid references usuarios(id) on delete set null,
  add column artifice_atribuido_em  timestamptz;

comment on column chamados.artifice_atribuido_por is 'Usuário (admin ou compras) que definiu o artífice responsável.';
comment on column chamados.artifice_atribuido_em is 'Momento em que o artífice foi definido/alterado.';

-- -----------------------------------------------------------------------------
-- Observações do artífice + registro de execução não realizada.
-- -----------------------------------------------------------------------------
alter table chamados
  add column observacao_artifice text,
  add column executado boolean not null default true,
  add column motivo_nao_execucao text,
  add constraint chk_motivo_nao_execucao check (executado or motivo_nao_execucao is not null);

comment on column chamados.observacao_artifice is 'Observação opcional do artífice sobre o atendimento.';
comment on column chamados.executado is 'false quando o artífice marcou o serviço como não executado (motivo obrigatório).';

-- -----------------------------------------------------------------------------
-- Chat da solicitação: só existe enquanto o chamado está em EM_ANALISE e
-- somente depois que o síndico/admin abre a dúvida (chamados.chat_aberto_em).
-- Vira somente-leitura (histórico) assim que o chamado sai de EM_ANALISE.
-- -----------------------------------------------------------------------------
alter table chamados
  add column chat_aberto_em timestamptz;

comment on column chamados.chat_aberto_em is 'Preenchido quando o síndico/admin inicia uma dúvida no chat da solicitação; habilita o morador a responder.';

create table solicitacao_mensagens (
  id           uuid primary key default gen_random_uuid(),
  chamado_id   uuid not null references chamados(id) on delete cascade,
  remetente    text not null check (remetente in ('ADMIN', 'MORADOR')),
  usuario_id   uuid references usuarios(id) on delete set null, -- preenchido quando remetente = ADMIN
  mensagem     text not null,
  criado_em    timestamptz not null default now()
);

comment on table solicitacao_mensagens is 'Chat entre síndico/admin e morador durante a análise de uma solicitação.';

create index idx_solicitacao_mensagens_chamado on solicitacao_mensagens (chamado_id);

-- -----------------------------------------------------------------------------
-- RLS mínima para a nova tabela de chat, seguindo o mesmo padrão de acesso
-- hoje usado pelo restante do projeto (sem autenticação por linha).
-- -----------------------------------------------------------------------------
alter table solicitacao_mensagens enable row level security;

create policy "solicitacao_mensagens_select" on solicitacao_mensagens
  for select using (true);

create policy "solicitacao_mensagens_insert" on solicitacao_mensagens
  for insert with check (true);

-- -----------------------------------------------------------------------------
-- Índices de apoio às novas buscas/filtros (nome do morador e número do chamado
-- já existem via idx_chamados_numero; aqui reforçamos ordenação/paginação).
-- -----------------------------------------------------------------------------
create index if not exists idx_chamados_criado_em on chamados (criado_em desc);
create index if not exists idx_usuarios_admin_master on usuarios (admin_master) where papel = 'ADMIN';
