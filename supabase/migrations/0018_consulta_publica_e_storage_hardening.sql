-- 0018_consulta_publica_e_storage_hardening.sql
-- Reduz enumeração pública de chamados/anexos e valida anexos também no banco.

create or replace function contato_confere_chamado(
  p_chamado_id uuid,
  p_contato text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from chamados c
    where c.id = p_chamado_id
      and (
        (
          c.morador_email is not null
          and lower(c.morador_email) = lower(btrim(coalesce(p_contato, '')))
        )
        or (
          length(regexp_replace(coalesce(p_contato, ''), '[^0-9]', '', 'g')) >= 10
          and regexp_replace(c.morador_whatsapp, '[^0-9]', '', 'g') =
              regexp_replace(coalesce(p_contato, ''), '[^0-9]', '', 'g')
        )
      )
  );
$$;

revoke all on function contato_confere_chamado(uuid, text) from public;

create or replace function abrir_chamado_publico(
  p_id uuid,
  p_condominio_id uuid,
  p_morador_nome text,
  p_morador_whatsapp text,
  p_morador_email text,
  p_local_problema text,
  p_tipo_problema tipo_problema,
  p_descricao text
)
returns table (id uuid, numero_chamado text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from condominios where condominios.id = p_condominio_id and ativo = true) then
    raise exception 'Condomínio não encontrado ou inativo';
  end if;
  if btrim(coalesce(p_morador_nome, '')) = '' or btrim(coalesce(p_morador_whatsapp, '')) = ''
     or btrim(coalesce(p_morador_email, '')) = '' or btrim(coalesce(p_local_problema, '')) = ''
     or btrim(coalesce(p_descricao, '')) = '' then
    raise exception 'Todos os campos obrigatórios devem ser preenchidos';
  end if;
  if length(btrim(p_morador_nome)) > 120
     or length(btrim(p_morador_whatsapp)) > 30
     or length(btrim(p_morador_email)) > 254
     or length(btrim(p_local_problema)) > 160
     or length(btrim(p_descricao)) > 2000 then
    raise exception 'Um ou mais campos excedem o tamanho permitido';
  end if;
  if lower(btrim(p_morador_email)) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'E-mail inválido';
  end if;
  if length(regexp_replace(p_morador_whatsapp, '[^0-9]', '', 'g')) not between 10 and 13 then
    raise exception 'WhatsApp inválido';
  end if;

  insert into chamados (id, condominio_id, morador_nome, morador_whatsapp, morador_email,
                        local_problema, tipo_problema, descricao)
  values (p_id, p_condominio_id, btrim(p_morador_nome), btrim(p_morador_whatsapp),
          lower(btrim(p_morador_email)), btrim(p_local_problema), p_tipo_problema, btrim(p_descricao));
  return query select c.id, c.numero_chamado from chamados c where c.id = p_id;
end;
$$;

create or replace function consultar_chamado_publico(
  p_numero_chamado text,
  p_contato text
)
returns table (chamado jsonb, anexos jsonb, historico jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select
    jsonb_build_object(
      'id', c.id, 'numero_chamado', c.numero_chamado, 'condominio_id', c.condominio_id,
      'morador_nome', c.morador_nome, 'morador_whatsapp', null, 'morador_email', null, 'local_problema', c.local_problema,
      'tipo_problema', c.tipo_problema, 'descricao', c.descricao, 'status', c.status,
      'motivo_rejeicao', c.motivo_rejeicao, 'observacao_compras', c.observacao_compras,
      'observacao_aprovacao', c.observacao_aprovacao, 'aprovado_por', null, 'compras_por', null,
      'artifice_id', null, 'criado_em', c.criado_em, 'aprovado_em', c.aprovado_em,
      'em_compras_em', c.em_compras_em, 'aguardando_execucao_em', c.aguardando_execucao_em,
      'em_andamento_em', c.em_andamento_em, 'finalizado_em', c.finalizado_em,
      'cancelado_em', c.cancelado_em, 'rejeitado_em', c.rejeitado_em, 'atualizado_em', c.atualizado_em,
      'artifice_atribuido_por', null, 'artifice_atribuido_em', null,
      'observacao_artifice', c.observacao_artifice, 'executado', c.executado,
      'motivo_nao_execucao', c.motivo_nao_execucao, 'chat_aberto_em', c.chat_aberto_em,
      'observacao_reabertura', c.observacao_reabertura
    ),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'chamado_id', a.chamado_id, 'tipo', a.tipo, 'url', a.url,
      'descricao', a.descricao, 'valor', null, 'enviado_por', null, 'criado_em', a.criado_em
    ) order by a.criado_em) from chamado_anexos a
      where a.chamado_id = c.id and a.tipo in ('FOTO_SOLICITACAO', 'ANEXO_REJEICAO', 'FOTO_DEPOIS')), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', h.id, 'chamado_id', h.chamado_id, 'status_anterior', h.status_anterior,
      'status_novo', h.status_novo, 'observacao', h.observacao, 'usuario_id', null,
      'evento', h.evento, 'detalhes', '{}'::jsonb, 'criado_em', h.criado_em
    ) order by h.criado_em) from chamado_historico h where h.chamado_id = c.id), '[]'::jsonb)
  from chamados c
  where c.numero_chamado = nullif(trim(p_numero_chamado), '')
    and c.numero_chamado ~ '^[0-9]{4}-[0-9]{6}$'
    and contato_confere_chamado(c.id, p_contato)
  limit 1;
$$;

revoke all on function consultar_chamado_publico(text) from public;
revoke execute on function consultar_chamado_publico(text) from anon, authenticated;
grant execute on function consultar_chamado_publico(text, text) to anon, authenticated;

create or replace function reabrir_chamado(
  p_numero_chamado text,
  p_contato text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  registro chamados;
begin
  if not exists (
    select 1 from configuracoes_sistema
    where chave = 'permitir_reabertura_morador' and valor_booleano = true
  ) then
    raise exception 'A reabertura de chamados está desativada';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe um motivo para reabrir o chamado';
  end if;
  if length(trim(coalesce(p_motivo, ''))) > 1000 then
    raise exception 'O motivo da reabertura excede o tamanho permitido';
  end if;

  select * into registro from chamados
  where numero_chamado = nullif(trim(p_numero_chamado), '')
    and numero_chamado ~ '^[0-9]{4}-[0-9]{6}$'
  limit 1;
  if registro.id is null then raise exception 'Chamado não encontrado'; end if;
  if registro.status not in ('FINALIZADO', 'NAO_EXECUTADO') then
    raise exception 'Somente chamados encerrados podem ser reabertos';
  end if;
  if not contato_confere_chamado(registro.id, p_contato) then
    raise exception 'Contato não confere com o chamado';
  end if;

  update chamados
  set status = 'EM_ANALISE',
      observacao_reabertura = trim(p_motivo),
      executado = true,
      motivo_nao_execucao = null,
      assumido_por = null,
      assumido_em = null,
      bloqueio_expira_em = null
  where id = registro.id;

  return jsonb_build_object('id', registro.id, 'numero_chamado', registro.numero_chamado, 'status', 'EM_ANALISE');
end;
$$;

drop policy if exists "chamados_anexos_storage_select" on storage.objects;
drop policy if exists "chamados_anexos_storage_insert" on storage.objects;

create policy "chamados_anexos_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'chamados-anexos' and meu_papel() is not null);

create policy "chamados_anexos_storage_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'chamados-anexos'
    and array_length(storage.foldername(name), 1) = 1
    and lower(name) ~ '^[0-9a-f-]{36}/(foto_solicitacao|orcamento|comprovante_compra|foto_antes|foto_depois|anexo_rejeicao)-[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
    and (
      meu_papel() is not null
      or (
        lower(name) ~ '^[0-9a-f-]{36}/foto_solicitacao-[0-9a-f-]{36}\.(jpg|png|webp)$'
        and chamado_em_analise_publico((storage.foldername(name))[1])
      )
    )
  );
