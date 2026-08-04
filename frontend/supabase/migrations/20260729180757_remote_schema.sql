


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."papel_usuario" AS ENUM (
    'ADMIN',
    'COMPRAS',
    'ARTIFICE'
);


ALTER TYPE "public"."papel_usuario" OWNER TO "postgres";


CREATE TYPE "public"."status_chamado" AS ENUM (
    'EM_ANALISE',
    'REJEITADO',
    'EM_COMPRAS',
    'AGUARDANDO_EXECUCAO',
    'EM_ANDAMENTO',
    'FINALIZADO',
    'CANCELADO'
);


ALTER TYPE "public"."status_chamado" OWNER TO "postgres";


CREATE TYPE "public"."tipo_anexo" AS ENUM (
    'FOTO_SOLICITACAO',
    'ANEXO_REJEICAO',
    'ORCAMENTO',
    'COMPROVANTE_COMPRA',
    'FOTO_ANTES',
    'FOTO_DEPOIS'
);


ALTER TYPE "public"."tipo_anexo" OWNER TO "postgres";


CREATE TYPE "public"."tipo_problema" AS ENUM (
    'ELETRICA',
    'HIDRAULICA',
    'REFORMA',
    'OUTROS'
);


ALTER TYPE "public"."tipo_problema" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_numero_chamado"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  proximo_numero bigint;
begin
  proximo_numero := nextval('chamado_numero_seq');
  return to_char(now(), 'YYYY') || '-' || lpad(proximo_numero::text, 6, '0');
end;
$$;


ALTER FUNCTION "public"."gerar_numero_chamado"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."gerar_numero_chamado"() IS 'Gera o número público do chamado (ex: 2026-000001), atribuído apenas na aprovação do admin.';



CREATE OR REPLACE FUNCTION "public"."handle_novo_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  usuario_encontrado usuarios;
begin
  select * into usuario_encontrado
  from usuarios
  where email = new.email
    and ativo = true
    and auth_user_id is null
  limit 1;

  if usuario_encontrado.id is null then
    raise exception
      'Este e-mail não foi cadastrado por um administrador. Peça ao síndico para te cadastrar em "Equipe interna" antes de criar sua senha.';
  end if;

  update usuarios set auth_user_id = new.id where id = usuario_encontrado.id;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_novo_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meu_papel"() RETURNS "public"."papel_usuario"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select papel from usuarios where auth_user_id = auth.uid() and ativo = true limit 1;
$$;


ALTER FUNCTION "public"."meu_papel"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."meu_papel"() IS 'Papel (ADMIN/COMPRAS/ARTIFICE) do usuário autenticado atual, ou null se não houver sessão/usuário vinculado.';



CREATE OR REPLACE FUNCTION "public"."meu_usuario_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from usuarios where auth_user_id = auth.uid() and ativo = true limit 1;
$$;


ALTER FUNCTION "public"."meu_usuario_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."meu_usuario_id"() IS 'Id em usuarios do usuário autenticado atual.';



CREATE OR REPLACE FUNCTION "public"."registrar_historico_chamado"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
      coalesce(new.motivo_rejeicao, new.observacao_compras),
      coalesce(new.aprovado_por, new.compras_por, new.artifice_id)
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."registrar_historico_chamado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_transicao_chamado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Nenhuma mudança de status: nada a validar aqui.
  if new.status = old.status then
    new.atualizado_em := now();
    return new;
  end if;

  -- A transição precisa existir no grafo de transições válidas.
  if not exists (
    select 1 from status_transicoes_validas
    where status_origem = old.status and status_destino = new.status
  ) then
    raise exception 'Transição de status inválida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- Regras de negócio específicas de cada transição -------------------------

  if new.status = 'REJEITADO' then
    if new.motivo_rejeicao is null or btrim(new.motivo_rejeicao) = '' then
      raise exception 'motivo_rejeicao é obrigatório ao rejeitar um chamado';
    end if;
    new.rejeitado_em := now();
  end if;

  if new.status = 'EM_COMPRAS' then
    -- Aprovação do admin: gera o número público do chamado.
    if new.numero_chamado is null then
      new.numero_chamado := gerar_numero_chamado();
    end if;
    new.aprovado_em := now();
    new.em_compras_em := now();
  end if;

  if new.status = 'AGUARDANDO_EXECUCAO' then
    -- Se compras optou por pular a compra de material, exige justificativa.
    -- (a aplicação decide se houve compra real checando chamado_anexos)
    if new.observacao_compras is not null and btrim(new.observacao_compras) = '' then
      raise exception 'observacao_compras não pode ser vazia quando informada';
    end if;
    new.aguardando_execucao_em := now();
  end if;

  if new.status = 'EM_ANDAMENTO' then
    if new.artifice_id is null then
      raise exception 'artifice_id é obrigatório para iniciar a execução do chamado';
    end if;
    new.em_andamento_em := now();
  end if;

  if new.status = 'FINALIZADO' then
    new.finalizado_em := now();
  end if;

  if new.status = 'CANCELADO' then
    new.cancelado_em := now();
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."validar_transicao_chamado"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."chamado_anexos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chamado_id" "uuid" NOT NULL,
    "tipo" "public"."tipo_anexo" NOT NULL,
    "url" "text" NOT NULL,
    "descricao" "text",
    "valor" numeric(12,2),
    "enviado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chamado_anexos" OWNER TO "postgres";


COMMENT ON TABLE "public"."chamado_anexos" IS 'Arquivos (fotos, orçamentos, comprovantes) vinculados a um chamado.';



CREATE TABLE IF NOT EXISTS "public"."chamado_historico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chamado_id" "uuid" NOT NULL,
    "status_anterior" "public"."status_chamado",
    "status_novo" "public"."status_chamado" NOT NULL,
    "observacao" "text",
    "usuario_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chamado_historico" OWNER TO "postgres";


COMMENT ON TABLE "public"."chamado_historico" IS 'Auditoria imutável de cada transição de status pela qual o chamado passou.';



CREATE SEQUENCE IF NOT EXISTS "public"."chamado_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."chamado_numero_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chamados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_chamado" "text",
    "condominio_id" "uuid" NOT NULL,
    "morador_nome" "text" NOT NULL,
    "morador_whatsapp" "text" NOT NULL,
    "local_problema" "text" NOT NULL,
    "tipo_problema" "public"."tipo_problema" DEFAULT 'OUTROS'::"public"."tipo_problema" NOT NULL,
    "descricao" "text" NOT NULL,
    "status" "public"."status_chamado" DEFAULT 'EM_ANALISE'::"public"."status_chamado" NOT NULL,
    "motivo_rejeicao" "text",
    "observacao_compras" "text",
    "aprovado_por" "uuid",
    "compras_por" "uuid",
    "artifice_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aprovado_em" timestamp with time zone,
    "em_compras_em" timestamp with time zone,
    "aguardando_execucao_em" timestamp with time zone,
    "em_andamento_em" timestamp with time zone,
    "finalizado_em" timestamp with time zone,
    "cancelado_em" timestamp with time zone,
    "rejeitado_em" timestamp with time zone,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chamados" OWNER TO "postgres";


COMMENT ON TABLE "public"."chamados" IS 'Chamados de manutenção abertos pelos moradores e acompanhados até a conclusão.';



COMMENT ON COLUMN "public"."chamados"."numero_chamado" IS 'Gerado apenas na aprovação do admin; é o código que o morador usa para consultar o status.';



CREATE TABLE IF NOT EXISTS "public"."condominios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "endereco" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."condominios" OWNER TO "postgres";


COMMENT ON TABLE "public"."condominios" IS 'Condomínios atendidos pelo sistema.';



CREATE TABLE IF NOT EXISTS "public"."status_transicoes_validas" (
    "status_origem" "public"."status_chamado" NOT NULL,
    "status_destino" "public"."status_chamado" NOT NULL
);


ALTER TABLE "public"."status_transicoes_validas" OWNER TO "postgres";


COMMENT ON TABLE "public"."status_transicoes_validas" IS 'Grafo de transições permitidas na máquina de estados dos chamados.';



CREATE TABLE IF NOT EXISTS "public"."usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "nome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "whatsapp" "text",
    "papel" "public"."papel_usuario" NOT NULL,
    "condominio_id" "uuid",
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "criado_por" "uuid"
);


ALTER TABLE "public"."usuarios" OWNER TO "postgres";


COMMENT ON TABLE "public"."usuarios" IS 'Usuários internos do sistema (admin, compras, artífice). Criados exclusivamente pelo admin.';



ALTER TABLE ONLY "public"."chamado_anexos"
    ADD CONSTRAINT "chamado_anexos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chamado_historico"
    ADD CONSTRAINT "chamado_historico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chamados"
    ADD CONSTRAINT "chamados_numero_chamado_key" UNIQUE ("numero_chamado");



ALTER TABLE ONLY "public"."chamados"
    ADD CONSTRAINT "chamados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."condominios"
    ADD CONSTRAINT "condominios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."status_transicoes_validas"
    ADD CONSTRAINT "status_transicoes_validas_pkey" PRIMARY KEY ("status_origem", "status_destino");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_chamado_anexos_chamado" ON "public"."chamado_anexos" USING "btree" ("chamado_id");



CREATE INDEX "idx_chamado_historico_chamado" ON "public"."chamado_historico" USING "btree" ("chamado_id");



CREATE INDEX "idx_chamados_artifice" ON "public"."chamados" USING "btree" ("artifice_id");



CREATE INDEX "idx_chamados_condominio" ON "public"."chamados" USING "btree" ("condominio_id");



CREATE INDEX "idx_chamados_numero" ON "public"."chamados" USING "btree" ("numero_chamado");



CREATE INDEX "idx_chamados_status" ON "public"."chamados" USING "btree" ("status");



CREATE INDEX "idx_usuarios_papel" ON "public"."usuarios" USING "btree" ("papel");



CREATE OR REPLACE TRIGGER "trg_registrar_historico_insert" AFTER INSERT ON "public"."chamados" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_historico_chamado"();



CREATE OR REPLACE TRIGGER "trg_registrar_historico_update" AFTER UPDATE ON "public"."chamados" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_historico_chamado"();



CREATE OR REPLACE TRIGGER "trg_validar_transicao_chamado" BEFORE UPDATE ON "public"."chamados" FOR EACH ROW EXECUTE FUNCTION "public"."validar_transicao_chamado"();



ALTER TABLE ONLY "public"."chamado_anexos"
    ADD CONSTRAINT "chamado_anexos_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "public"."chamados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chamado_anexos"
    ADD CONSTRAINT "chamado_anexos_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chamado_historico"
    ADD CONSTRAINT "chamado_historico_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "public"."chamados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chamado_historico"
    ADD CONSTRAINT "chamado_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chamados"
    ADD CONSTRAINT "chamados_aprovado_por_fkey" FOREIGN KEY ("aprovado_por") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chamados"
    ADD CONSTRAINT "chamados_artifice_id_fkey" FOREIGN KEY ("artifice_id") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chamados"
    ADD CONSTRAINT "chamados_compras_por_fkey" FOREIGN KEY ("compras_por") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chamados"
    ADD CONSTRAINT "chamados_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL;



ALTER TABLE "public"."chamado_anexos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chamado_anexos_insert_publico" ON "public"."chamado_anexos" FOR INSERT WITH CHECK (true);



CREATE POLICY "chamado_anexos_select_publico" ON "public"."chamado_anexos" FOR SELECT USING (true);



ALTER TABLE "public"."chamado_historico" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chamado_historico_select_publico" ON "public"."chamado_historico" FOR SELECT USING (true);



ALTER TABLE "public"."chamados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chamados_insert_publico" ON "public"."chamados" FOR INSERT WITH CHECK (true);



CREATE POLICY "chamados_select_publico" ON "public"."chamados" FOR SELECT USING (true);



CREATE POLICY "chamados_update_admin" ON "public"."chamados" FOR UPDATE USING (("public"."meu_papel"() = 'ADMIN'::"public"."papel_usuario")) WITH CHECK (("public"."meu_papel"() = 'ADMIN'::"public"."papel_usuario"));



CREATE POLICY "chamados_update_artifice" ON "public"."chamados" FOR UPDATE USING ((("public"."meu_papel"() = 'ARTIFICE'::"public"."papel_usuario") AND ("status" = ANY (ARRAY['AGUARDANDO_EXECUCAO'::"public"."status_chamado", 'EM_ANDAMENTO'::"public"."status_chamado"])))) WITH CHECK (("public"."meu_papel"() = 'ARTIFICE'::"public"."papel_usuario"));



CREATE POLICY "chamados_update_compras" ON "public"."chamados" FOR UPDATE USING ((("public"."meu_papel"() = 'COMPRAS'::"public"."papel_usuario") AND ("status" = 'EM_COMPRAS'::"public"."status_chamado"))) WITH CHECK (("public"."meu_papel"() = 'COMPRAS'::"public"."papel_usuario"));



ALTER TABLE "public"."condominios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "condominios_insert_admin" ON "public"."condominios" FOR INSERT WITH CHECK (("public"."meu_papel"() = 'ADMIN'::"public"."papel_usuario"));



CREATE POLICY "condominios_select_publico" ON "public"."condominios" FOR SELECT USING (true);



CREATE POLICY "condominios_update_admin" ON "public"."condominios" FOR UPDATE USING (("public"."meu_papel"() = 'ADMIN'::"public"."papel_usuario"));



CREATE POLICY "status_transicoes_select_publico" ON "public"."status_transicoes_validas" FOR SELECT USING (true);



ALTER TABLE "public"."status_transicoes_validas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usuarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_insert_admin" ON "public"."usuarios" FOR INSERT WITH CHECK (("public"."meu_papel"() = 'ADMIN'::"public"."papel_usuario"));



CREATE POLICY "usuarios_select_proprio_ou_admin" ON "public"."usuarios" FOR SELECT USING ((("auth_user_id" = "auth"."uid"()) OR ("public"."meu_papel"() = 'ADMIN'::"public"."papel_usuario")));



CREATE POLICY "usuarios_update_admin" ON "public"."usuarios" FOR UPDATE USING (("public"."meu_papel"() = 'ADMIN'::"public"."papel_usuario"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."gerar_numero_chamado"() TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_numero_chamado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_numero_chamado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_novo_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_novo_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_novo_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."meu_papel"() TO "anon";
GRANT ALL ON FUNCTION "public"."meu_papel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meu_papel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."meu_usuario_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."meu_usuario_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meu_usuario_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_historico_chamado"() TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_historico_chamado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_historico_chamado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_transicao_chamado"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_transicao_chamado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_transicao_chamado"() TO "service_role";


















GRANT ALL ON TABLE "public"."chamado_anexos" TO "anon";
GRANT ALL ON TABLE "public"."chamado_anexos" TO "authenticated";
GRANT ALL ON TABLE "public"."chamado_anexos" TO "service_role";



GRANT ALL ON TABLE "public"."chamado_historico" TO "anon";
GRANT ALL ON TABLE "public"."chamado_historico" TO "authenticated";
GRANT ALL ON TABLE "public"."chamado_historico" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chamado_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chamado_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chamado_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chamados" TO "anon";
GRANT ALL ON TABLE "public"."chamados" TO "authenticated";
GRANT ALL ON TABLE "public"."chamados" TO "service_role";



GRANT ALL ON TABLE "public"."condominios" TO "anon";
GRANT ALL ON TABLE "public"."condominios" TO "authenticated";
GRANT ALL ON TABLE "public"."condominios" TO "service_role";



GRANT ALL ON TABLE "public"."status_transicoes_validas" TO "anon";
GRANT ALL ON TABLE "public"."status_transicoes_validas" TO "authenticated";
GRANT ALL ON TABLE "public"."status_transicoes_validas" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios" TO "anon";
GRANT ALL ON TABLE "public"."usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































