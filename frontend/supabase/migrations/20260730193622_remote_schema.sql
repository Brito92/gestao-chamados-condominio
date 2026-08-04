drop extension if exists "pg_net";

alter table "public"."chamados" add column "observacao_aprovacao" text;

alter table "public"."usuarios" add column "admin_master" boolean not null default false;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.registrar_historico_chamado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into chamado_historico (chamado_id, status_anterior, status_novo, observacao)
    values (new.id, null, new.status, 'Chamado criado pelo morador');
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into chamado_historico (chamado_id, status_anterior, status_novo, observacao, usuario_id)
    values (
      new.id,
      old.status,
      new.status,
      coalesce(new.motivo_rejeicao, new.observacao_compras, new.observacao_aprovacao),
      coalesce(new.aprovado_por, new.compras_por, new.artifice_id)
    );
  end if;

  return new;
end;
$function$
;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_novo_auth_user();


  create policy "chamados_anexos_storage_insert"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'chamados-anexos'::text));



  create policy "chamados_anexos_storage_select"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'chamados-anexos'::text));



