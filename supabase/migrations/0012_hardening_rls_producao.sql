-- =============================================================================
-- 0012_hardening_rls_producao.sql
-- Fecha as policies permissivas do MVP e mantém públicos apenas os fluxos
-- necessários ao morador: listar condomínios ativos, abrir chamado, anexar
-- foto inicial e consultar um chamado pelo número.
-- =============================================================================

alter table condominios enable row level security;
alter table usuarios enable row level security;
alter table chamados enable row level security;
alter table chamado_anexos enable row level security;
alter table chamado_historico enable row level security;
alter table status_transicoes_validas enable row level security;

drop policy if exists "condominios_select_publico" on condominios;
drop policy if exists "condominios_insert_publico_mvp" on condominios;
drop policy if exists "condominios_update_publico_mvp" on condominios;
drop policy if exists "condominios_insert_admin" on condominios;
drop policy if exists "condominios_update_admin" on condominios;
drop policy if exists "condominios_delete_admin" on condominios;

drop policy if exists "usuarios_select_publico_mvp" on usuarios;
drop policy if exists "usuarios_insert_publico_mvp" on usuarios;
drop policy if exists "usuarios_update_publico_mvp" on usuarios;
drop policy if exists "usuarios_select_proprio_ou_admin" on usuarios;
drop policy if exists "usuarios_select_equipe_interna" on usuarios;
drop policy if exists "usuarios_insert_admin" on usuarios;
drop policy if exists "usuarios_update_admin" on usuarios;

drop policy if exists "chamados_select_publico" on chamados;
drop policy if exists "chamados_insert_publico" on chamados;
drop policy if exists "chamados_update_publico_mvp" on chamados;
drop policy if exists "chamados_update_admin" on chamados;
drop policy if exists "chamados_update_compras" on chamados;
drop policy if exists "chamados_update_artifice" on chamados;

drop policy if exists "chamado_anexos_select_publico" on chamado_anexos;
drop policy if exists "chamado_anexos_insert_publico" on chamado_anexos;
drop policy if exists "chamado_anexos_select_interno" on chamado_anexos;
drop policy if exists "chamado_anexos_insert_controlado" on chamado_anexos;

drop policy if exists "chamado_historico_select_publico" on chamado_historico;
drop policy if exists "chamado_historico_select_interno" on chamado_historico;

drop policy if exists "status_transicoes_select_publico" on status_transicoes_validas;

create or replace function meu_admin_master()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from usuarios
    where auth_user_id = auth.uid()
      and ativo = true
      and papel = 'ADMIN'
      and admin_master = true
  );
$$;

create or replace function pode_editar_usuario(usuario_alvo uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select meu_admin_master()
    or exists (
      select 1
      from usuarios alvo
      where alvo.id = usuario_alvo
        and (alvo.papel <> 'ADMIN' or alvo.id = meu_usuario_id())
    );
$$;

-- Condomínios: público só enxerga ativos para abrir chamado; admin enxerga e
-- gerencia todos, incluindo inativos.
create policy "condominios_select_publico_ativos_ou_admin" on condominios
  for select using (ativo = true or meu_papel() = 'ADMIN');

create policy "condominios_insert_admin" on condominios
  for insert with check (meu_papel() = 'ADMIN');

create policy "condominios_update_admin" on condominios
  for update using (meu_papel() = 'ADMIN')
  with check (meu_papel() = 'ADMIN');

create policy "condominios_delete_admin" on condominios
  for delete using (meu_papel() = 'ADMIN');

-- Usuários: nenhum acesso anônimo. A equipe autenticada pode consultar dados
-- básicos da equipe; somente admin gerencia usuários. Admin comum não cria nem
-- edita outros admins, regra aplicada por pode_editar_usuario().
create policy "usuarios_select_equipe_interna" on usuarios
  for select using (meu_papel() is not null);

create policy "usuarios_insert_admin" on usuarios
  for insert
  with check (
    meu_papel() = 'ADMIN'
    and (meu_admin_master() or papel in ('COMPRAS', 'ARTIFICE'))
  );

create policy "usuarios_update_admin" on usuarios
  for update
  using (meu_papel() = 'ADMIN' and pode_editar_usuario(id))
  with check (
    meu_papel() = 'ADMIN'
    and (meu_admin_master() or papel <> 'ADMIN' or id = meu_usuario_id())
  );

-- Chamados: criação pública continua liberada, mas somente no formato inicial
-- da solicitação. Leitura e atualizações diretas exigem equipe autenticada.
create policy "chamados_select_interno" on chamados
  for select using (
    meu_papel() = 'ADMIN'
    or (meu_papel() = 'COMPRAS' and status = 'EM_COMPRAS')
    or (
      meu_papel() = 'ARTIFICE'
      and (
        (
          status in ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO')
          and (artifice_id is null or artifice_id = meu_usuario_id())
        )
        or (status = 'FINALIZADO' and artifice_id = meu_usuario_id())
      )
    )
  );

create policy "chamados_insert_publico" on chamados
  for insert
  with check (
    status = 'EM_ANALISE'
    and numero_chamado is null
    and motivo_rejeicao is null
    and observacao_compras is null
    and observacao_aprovacao is null
    and aprovado_por is null
    and compras_por is null
    and artifice_id is null
    and artifice_atribuido_por is null
    and artifice_atribuido_em is null
    and observacao_artifice is null
    and motivo_nao_execucao is null
    and chat_aberto_em is null
    and aprovado_em is null
    and em_compras_em is null
    and aguardando_execucao_em is null
    and em_andamento_em is null
    and finalizado_em is null
    and cancelado_em is null
    and rejeitado_em is null
    and executado = true
    and exists (
      select 1
      from condominios c
      where c.id = condominio_id
        and c.ativo = true
    )
  );

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
  using (
    meu_papel() = 'ARTIFICE'
    and status in ('AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO')
    and (artifice_id is null or artifice_id = meu_usuario_id())
  )
  with check (meu_papel() = 'ARTIFICE');

create or replace function chamado_em_analise_publico(p_chamado_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from chamados c
    where p_chamado_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and c.id = p_chamado_id::uuid
      and c.status = 'EM_ANALISE'
  );
$$;

-- Anexos: público só registra foto inicial do próprio fluxo de abertura.
-- Demais anexos exigem usuário interno autenticado.
create policy "chamado_anexos_select_interno" on chamado_anexos
  for select using (
    exists (
      select 1
      from chamados c
      where c.id = chamado_id
    )
  );

create policy "chamado_anexos_insert_controlado" on chamado_anexos
  for insert
  with check (
    (
      tipo = 'FOTO_SOLICITACAO'
      and enviado_por is null
      and chamado_em_analise_publico(chamado_id::text)
    )
    or (
      meu_papel() is not null
      and enviado_por = meu_usuario_id()
    )
  );

create policy "chamado_historico_select_interno" on chamado_historico
  for select using (
    exists (
      select 1
      from chamados c
      where c.id = chamado_id
    )
  );

create policy "status_transicoes_select_publico" on status_transicoes_validas
  for select using (true);

-- Consulta pública controlada: não abre SELECT direto na tabela chamados.
-- O morador consulta somente por número do chamado e recebe apenas campos
-- necessários para acompanhamento.
create or replace function consultar_chamado_publico(p_numero_chamado text)
returns table (
  chamado jsonb,
  anexos jsonb,
  historico jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jsonb_build_object(
      'id', c.id,
      'numero_chamado', c.numero_chamado,
      'condominio_id', c.condominio_id,
      'morador_nome', c.morador_nome,
      'morador_whatsapp', null,
      'local_problema', c.local_problema,
      'tipo_problema', c.tipo_problema,
      'descricao', c.descricao,
      'status', c.status,
      'motivo_rejeicao', c.motivo_rejeicao,
      'observacao_compras', c.observacao_compras,
      'observacao_aprovacao', c.observacao_aprovacao,
      'aprovado_por', null,
      'compras_por', null,
      'artifice_id', null,
      'criado_em', c.criado_em,
      'aprovado_em', c.aprovado_em,
      'em_compras_em', c.em_compras_em,
      'aguardando_execucao_em', c.aguardando_execucao_em,
      'em_andamento_em', c.em_andamento_em,
      'finalizado_em', c.finalizado_em,
      'cancelado_em', c.cancelado_em,
      'rejeitado_em', c.rejeitado_em,
      'atualizado_em', c.atualizado_em,
      'artifice_atribuido_por', null,
      'artifice_atribuido_em', c.artifice_atribuido_em,
      'observacao_artifice', c.observacao_artifice,
      'executado', c.executado,
      'motivo_nao_execucao', c.motivo_nao_execucao,
      'chat_aberto_em', c.chat_aberto_em
    ) as chamado,
    '[]'::jsonb as anexos,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', h.id,
            'chamado_id', h.chamado_id,
            'status_anterior', h.status_anterior,
            'status_novo', h.status_novo,
            'observacao', h.observacao,
            'usuario_id', null,
            'criado_em', h.criado_em
          )
          order by h.criado_em
        )
        from chamado_historico h
        where h.chamado_id = c.id
      ),
      '[]'::jsonb
    ) as historico
  from chamados c
  where c.numero_chamado = nullif(trim(p_numero_chamado), '')
    and c.numero_chamado is not null
  limit 1;
$$;

grant execute on function consultar_chamado_publico(text) to anon, authenticated;

-- Storage: leitura segue pública porque o bucket é público, mas upload fica
-- restrito ao bucket correto e ao padrão chamado_id/arquivo.
drop policy if exists "chamados_anexos_storage_select" on storage.objects;
drop policy if exists "chamados_anexos_storage_insert" on storage.objects;

create policy "chamados_anexos_storage_select" on storage.objects
  for select using (bucket_id = 'chamados-anexos');

create policy "chamados_anexos_storage_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'chamados-anexos'
    and array_length(storage.foldername(name), 1) = 1
    and (
      meu_papel() is not null
      or chamado_em_analise_publico((storage.foldername(name))[1])
    )
  );

do $$
begin
  if to_regclass('public.solicitacao_mensagens') is not null then
    execute 'drop policy if exists "solicitacao_mensagens_select" on solicitacao_mensagens';
    execute 'drop policy if exists "solicitacao_mensagens_insert" on solicitacao_mensagens';
    execute 'drop policy if exists "solicitacao_mensagens_select_controlado" on solicitacao_mensagens';
    execute 'drop policy if exists "solicitacao_mensagens_insert_controlado" on solicitacao_mensagens';
    execute 'alter table solicitacao_mensagens enable row level security';
    execute 'create policy "solicitacao_mensagens_select_controlado" on solicitacao_mensagens for select using (meu_papel() = ''ADMIN'')';
    execute 'create policy "solicitacao_mensagens_insert_controlado" on solicitacao_mensagens for insert with check (meu_papel() = ''ADMIN'')';
  end if;
end $$;
