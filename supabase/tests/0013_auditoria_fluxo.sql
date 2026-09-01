-- Testes de regressão para executar no SQL Editor/CI após aplicar as migrations.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'chamados' and column_name = 'morador_email') then
    raise exception 'morador_email não foi criado';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'chamados' and column_name = 'assumido_por') then
    raise exception 'lock de chamado não foi criado';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'chamado_historico' and column_name = 'evento') then
    raise exception 'evento de auditoria não foi criado';
  end if;
  if not exists (select 1 from status_transicoes_validas where status_origem = 'FINALIZADO' and status_destino = 'EM_ANALISE') then
    raise exception 'transição de reabertura não foi criada';
  end if;
  if to_regprocedure('public.assumir_chamado(uuid)') is null then
    raise exception 'RPC assumir_chamado não foi criada';
  end if;
  if to_regprocedure('public.reabrir_chamado(text,text,text)') is null then
    raise exception 'RPC reabrir_chamado não foi criada';
  end if;
end $$;
