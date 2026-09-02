-- Regressoes da atribuicao e apropriacao de chamados por artifices.
do $$
begin
  if to_regprocedure('public.iniciar_execucao_artifice(uuid)') is null then
    raise exception 'RPC iniciar_execucao_artifice nao foi criada';
  end if;

  if to_regprocedure('public.proteger_atribuicao_artifice()') is null then
    raise exception 'Trigger de protecao da atribuicao nao foi criada';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_proteger_atribuicao_artifice'
      and tgrelid = 'public.chamados'::regclass
      and not tgisinternal
  ) then
    raise exception 'Trigger de protecao da atribuicao nao foi ativado';
  end if;
end $$;
