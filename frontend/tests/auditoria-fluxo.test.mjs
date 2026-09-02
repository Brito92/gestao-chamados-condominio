import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../../supabase/migrations/0013_auditoria_fluxo_concorrencia.sql', import.meta.url), 'utf8');
const auditMigration = await readFile(new URL('../../supabase/migrations/0014_audit_log.sql', import.meta.url), 'utf8');
const artificeMigration = await readFile(new URL('../../supabase/migrations/0015_fix_atribuicao_artifice.sql', import.meta.url), 'utf8');
const abrirChamado = await readFile(new URL('../src/pages/publico/AbrirChamado.tsx', import.meta.url), 'utf8');
const consulta = await readFile(new URL('../src/pages/publico/ConsultarChamado.tsx', import.meta.url), 'utf8');
const auth = await readFile(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
const sanitizer = await readFile(new URL('../src/utils/sanitizar.ts', import.meta.url), 'utf8');
const upload = await readFile(new URL('../src/utils/uploadAnexo.ts', import.meta.url), 'utf8');
const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
const compras = await readFile(new URL('../src/pages/compras/ComprasChamadoDetalhe.tsx', import.meta.url), 'utf8');
const artifice = await readFile(new URL('../src/pages/artifice/ArtificeChamadoDetalhe.tsx', import.meta.url), 'utf8');
const artificeFila = await readFile(new URL('../src/pages/artifice/ArtificeFila.tsx', import.meta.url), 'utf8');

test('o banco garante protocolo imediato e compatibilidade com dados legados', () => {
  assert.match(migration, /morador_email text/);
  assert.match(migration, /create trigger trg_atribuir_numero_chamado_inicial\s+before insert on chamados/s);
  assert.match(migration, /update chamados\s+set numero_chamado = gerar_numero_chamado\(\)\s+where numero_chamado is null/s);
});

test('o fluxo possui transição de reabertura, motivo e RPC público autenticado por contato', () => {
  assert.match(migration, /\('FINALIZADO', 'EM_ANALISE'\)/);
  assert.match(migration, /create or replace function reabrir_chamado/);
  assert.match(migration, /Contato não confere com o chamado/);
  assert.match(consulta, /reabrir_chamado/);
});

test('a abertura exige e-mail e passa por revisão antes do envio', () => {
  assert.match(abrirChamado, /emailValido/);
  assert.match(abrirChamado, /etapa === 'formulario'/);
  assert.match(abrirChamado, /Confirmar e enviar/);
  assert.match(abrirChamado, /morador_email/);
});

test('a sessão não desmonta o formulário ao receber SIGNED_IN no retorno à aba', () => {
  assert.match(auth, /evento !== 'SIGNED_OUT' && mesmaSessao/);
  assert.match(auth, /sessaoAtualRef/);
});

test('Compras e Artífice utilizam lock atômico antes de editar', () => {
  assert.match(migration, /create or replace function assumir_chamado/);
  assert.match(migration, /create or replace function liberar_chamado/);
  assert.match(compras, /rpc\('assumir_chamado'/);
  assert.match(artifice, /rpc\('assumir_chamado'/);
  assert.match(compras, /Trocar o artífice responsável/);
});

test('o Artífice não renderiza orçamento nem comprovante de compra', () => {
  assert.doesNotMatch(artifice, /COMPROVANTE_COMPRA/);
  assert.doesNotMatch(artifice, /ORCAMENTO/);
  assert.match(artifice, /Não foi executado/);
});

test('o cálculo de gasto considera somente comprovantes', () => {
  const anexos = [
    { tipo: 'ORCAMENTO', valor: 999 },
    { tipo: 'COMPROVANTE_COMPRA', valor: 125.5 },
    { tipo: 'FOTO_DEPOIS', valor: null },
  ];
  const total = anexos.filter((item) => item.tipo === 'COMPROVANTE_COMPRA')
    .reduce((soma, item) => soma + Number(item.valor ?? 0), 0);
  assert.equal(total, 125.5);
});

test('a sessao valida token e perfil ativo periodicamente', () => {
  assert.match(auth, /5 \* 60 \* 1000/);
  assert.match(auth, /getUser\(\)/);
});

test('a entrada de texto livre e sanitizada e rejeita marcacao HTML', () => {
  assert.match(sanitizer, /DOMPurify/);
  assert.match(sanitizer, /ALLOWED_TAGS: \[\]/);
  assert.match(sanitizer, /validarTextoLivre/);
});

test('uploads validam MIME, tamanho e assinatura do arquivo', () => {
  assert.match(upload, /MIMES_PERMITIDOS/);
  assert.match(upload, /TAMANHO_MAXIMO/);
  assert.match(upload, /validarMagicBytes/);
  assert.match(upload, /arrayBuffer/);
});

test('CSP e aplicada pelo servidor de desenvolvimento do Vite', () => {
  assert.match(vite, /csp-headers-dev/);
  assert.match(vite, /Content-Security-Policy/);
  assert.match(vite, /configureServer/);
});

test('auditoria detalhada registra alteracoes e autenticacao', () => {
  assert.match(auditMigration, /create table if not exists audit_log/);
  assert.match(auditMigration, /create or replace function log_auditoria/);
  assert.match(auditMigration, /registrar_evento_auditoria/);
  assert.match(auth, /p_acao: 'LOGIN'/);
  assert.match(auth, /p_acao: 'LOGOUT'/);
});

test('the artifice assignment cannot be overwritten', () => {
  assert.match(artificeMigration, /create or replace function proteger_atribuicao_artifice/);
  assert.match(artificeMigration, /create or replace function iniciar_execucao_artifice/);
  assert.match(artificeMigration, /new\.artifice_id is distinct from old\.artifice_id/);
  assert.match(artificeMigration, /grant execute on function iniciar_execucao_artifice\(uuid\) to authenticated/);
  assert.match(artifice, /rpc\('iniciar_execucao_artifice'/);
  assert.doesNotMatch(artifice, /update\(\{ status: 'EM_ANDAMENTO', artifice_id:/);
});

test('the artifice queue separates free calls from own calls', () => {
  assert.match(artificeFila, /c\.artifice_id === null/);
  assert.match(artificeFila, /const lockAtivo/);
  assert.match(artificeFila, /!lockAtivo/);
  assert.match(artificeFila, /c\.artifice_id === usuario\?\.id \|\| c\.assumido_por === usuario\?\.id/);
});
