# Grupo GL — Sistema de Gestão de Chamados e Manutenção de Condomínios (MVP)

Sistema mobile-first para abertura e acompanhamento de chamados de manutenção
condominial, com autenticação real para a equipe interna (Admin, Compras, Artífice)
e fluxo simplificado para moradores.

## Estrutura do projeto

```
condominio-chamados/
├── supabase/
│   └── migrations/          # SQL para rodar no Supabase, em ordem
│       ├── 0001_schema_base.sql           # tabelas, enums, índices
│       ├── 0002_state_machine.sql         # numeração de chamado + máquina de estados
│       ├── 0003_atualizacoes_gestao.sql   # admin_master, artífice, chat
│       ├── 0004_seed.sql                  # condomínio + admin provisório + dados de teste
│       ├── 0005_auth_integration.sql      # Supabase Auth + RLS por papel
│       ├── 0006_observacao_aprovacao.sql  # campo de observação na aprovação
│       ├── 0007_atualiza_trigger_historico.sql  # atualiza trigger com observação
│       ├── 0008_fix_rls_policies.sql     # recria policies de UPDATE
│       └── 0009_fix_trigger_security.sql  # corrige SECURITY DEFINER
└── frontend/                # React + Vite + TypeScript + Tailwind + Capacitor
    └── src/
        ├── pages/publico/    # telas do morador (sem login)
        ├── pages/admin/      # telas do síndico/admin
        ├── pages/compras/    # telas do setor de compras
        ├── pages/artifice/   # telas do artífice/técnico
        ├── components/       # componentes de UI reutilizáveis
        ├── context/          # AuthContext (Supabase Auth)
        ├── hooks/            # data fetching (Supabase)
        ├── lib/               # client do Supabase
        ├── types/            # tipos TS espelhando o schema do banco
        └── utils/            # regras de domínio (status, upload de anexos)
```

## 1. Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor** no painel do projeto.
3. Rode, **na ordem**, o conteúdo de cada arquivo em `supabase/migrations/`:
   1. `0001_schema_base.sql`
   2. `0002_state_machine.sql`
   3. `0003_atualizacoes_gestao.sql`
   4. `0004_seed.sql`
   5. `0005_auth_integration.sql`
   6. `0006_observacao_aprovacao.sql`
   7. `0007_atualiza_trigger_historico.sql`
   8. `0008_fix_rls_policies.sql`
   9. `0009_fix_trigger_security.sql`
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

Após rodar as migrations você já terá:
- Um condomínio de exemplo ("Condomínio Residencial Jequitibá").
- Um **usuário admin master provisório** (`admin@condominio.dev`) para testar.
- Um usuário de Compras e um Artífice de exemplo.
- Um chamado de exemplo em `EM_ANALISE`, pronto para aprovar/rejeitar.
- O bucket de Storage `chamados-anexos` (público) para fotos e anexos.

Após `0009`, aplique também, na ordem, `0010_correcoes_permissoes_historico.sql`, `0011_rls_policies.sql`, `0012_hardening_rls_producao.sql` e `0013_auditoria_fluxo_concorrencia.sql`. A última migration adiciona protocolo na abertura, revisão do formulário, reabertura parametrizável, trilha de auditoria detalhada e locks atômicos para Compras/Artífice.

## 2. Rodando o frontend

Depois das migrations 0012 e 0013, aplique tambem `supabase/migrations/0014_audit_log.sql` e, em seguida, `supabase/migrations/0015_fix_atribuicao_artifice.sql`. A 0015 corrige a fila do artifice, inicia a execucao por RPC atomica e impede sobrescrita de atribuicao. A CSP do Vite vale para o servidor de desenvolvimento; a politica de producao deve ser configurada no provedor de hospedagem.

```bash
cd frontend
cp .env.example .env
# edite .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

Acesse `http://localhost:5173`. Para testar como celular, use as ferramentas
de dispositivo móvel do navegador (o layout é mobile-first).

**Build Android:**
```bash
npm run build
npx cap sync android
npx cap open android
```

## 3. Login da equipe interna

- **Morador**: sem conta. `/` → "Relatar um problema" ou "Consultar meu chamado".
- **Equipe interna** (Admin, Compras, Artífice): acesse `/login`.
  - **Primeiro acesso**: o admin cadastra a pessoa em "Equipe interna"
    (nome, e-mail, papel, condomínio). A pessoa vai em `/login` → aba "Primeiro
    acesso", informa o **mesmo e-mail** e escolhe uma senha.
  - **Acessos seguintes**: aba "Entrar", com e-mail e senha.
  - Cada papel só vê a navegação e os chamados relevantes à sua etapa.

O **admin master provisório do seed** é `admin@condominio.dev` — use "Primeiro
acesso" com esse e-mail para testar (senha com 6+ caracteres).

## 4. Visão de cada perfil

### Admin/Síndico
- **Dashboard**: métricas (chamados em análise, gastos totais, etc.)
- **Solicitações**: fila de chamados em `EM_ANALISE` para aprovar/rejeitar
  - Campo de observação opcional ao aprovar (visível nas próximas etapas)
  - Visualização melhorada de fotos (modal de tela cheia)
- **Chamados**: lista completa de todos os chamados do sistema
- **Equipe interna**: gestão de usuários (criar, editar, ativar/desativar)
  - Seletor de condomínio para cada usuário
  - Admin master pode criar/editar outros admins
  - Admin comum não pode editar admin master
- **Condomínios**: gestão de condomínios (criar, editar, ativar/desativar)

### Compras
- Enxerga **somente** chamados em `EM_COMPRAS` (aprovados pelo admin)
- Para cada chamado:
  - Visualiza observação do admin (se houver)
  - Visualiza fotos da solicitação (modal de tela cheia)
  - Registra compra (orçamento, comprovante, valor) ou avança sem compra
  - Atribui artífice para execução

### Artífice
- Enxerga **somente** chamados em `AGUARDANDO_EXECUCAO`/`EM_ANDAMENTO`
- Para cada chamado:
  - Visualiza observações do admin e compras
  - Visualiza fotos da solicitação, orçamentos e comprovantes (modal)
  - Inicia execução, anexa fotos antes/depois
  - Registra observação opcional e finaliza

### Admin Master
- Visão detalhada de todas as etapas do chamado
- Visualiza todas as observações (aprovação, compras, artífice)
- Visualiza todos os anexos com tipos e valores
- Pode criar/editar outros administradores

## 5. Ciclo de vida do chamado (state machine)

O grafo de transições é validado **no banco de dados** via trigger:

```
EM_ANALISE ──► EM_COMPRAS ──► AGUARDANDO_EXECUCAO ──► EM_ANDAMENTO ──► FINALIZADO
    │                │                  │                   │
    ├──► REJEITADO   └──► CANCELADO     └──► CANCELADO       └──► CANCELADO
    └──► CANCELADO
```

Regras aplicadas via trigger:
- `REJEITADO` exige `motivo_rejeicao` preenchido
- `EM_COMPRAS` gera o `numero_chamado` público
- `EM_ANDAMENTO` exige `artifice_id` definido
- Toda transição é registrada em `chamado_historico` (auditoria imutável)

## 6. Segurança e Permissões

- **Autenticação**: Supabase Auth para equipe interna
- **RLS**: Políticas por papel no banco:
  - `ADMIN`: pode aprovar/rejeitar e editar qualquer chamado
  - `COMPRAS`: só pode atualizar chamados em `EM_COMPRAS`
  - `ARTIFICE`: só pode atualizar chamados em `AGUARDANDO_EXECUCAO`/`EM_ANDAMENTO`
- **Admin Master**: pode criar/editar outros admins e editar admin master
- **Admin Comum**: não pode editar admin master
- **Morador**: leitura pública para consulta por número do chamado

## Auditoria e operação concorrente

- O protocolo é gerado no momento da abertura e aparece imediatamente na tela de sucesso.
- A abertura tem etapa de revisão antes do envio; o e-mail do morador é obrigatório para novas solicitações.
- Compras e Artífice precisam assumir o chamado; o lock é atômico, expira em 15 minutos e pode ser liberado.
- Reatribuições, observações, transições e reaberturas ficam na trilha com evento e responsável.
- O morador pode solicitar reabertura de chamados finalizados quando `permitir_reabertura_morador` estiver habilitado em `configuracoes_sistema`.
- Testes estáticos do frontend: `npm test` (requer Node.js instalado).
- Asserções SQL de regressão: `supabase/tests/0013_auditoria_fluxo.sql`.

## 7. Funcionalidades Implementadas

### Campo de Observação na Aprovação
- Admin pode adicionar observação opcional ao aprovar solicitação
- Observação é visível nas etapas de compras e artífice
- Registrada no histórico do chamado

### Visualizador de Imagens
- Componente modal para visualização de fotos em tela cheia
- Aplicado em todas as telas (admin, compras, artífice)
- Suporte para zoom e navegação entre imagens

### Gestão de Usuários
- Criação de usuários com seleção de condomínio
- Edição de usuários existentes (nome, e-mail, papel, condomínio)
- Ativação/desativação de usuários
- Validações de permissão (admin comum vs master)

### Multi-condomínio
- Schema suporta múltiplos condomínios
- Cada usuário vinculado a um condomínio específico
- Admin pode gerenciar condomínios

## 8. Decisões de Escopo

- Morador continua sem login (fluxo simplificado)
- Notificações via WhatsApp não implementadas (schema preparado)
- Recuperação de senha via Supabase Auth padrão
- Relatórios financeiros detalhados não implementados
- Atribuição manual de artífice pode ser adicionada depois
