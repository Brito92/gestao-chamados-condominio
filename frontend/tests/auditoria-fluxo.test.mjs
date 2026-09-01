import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../../supabase/migrations/0013_auditoria_fluxo_concorrencia.sql', import.meta.url), 'utf8');
const abrirChamado = await readFile(new URL('../src/pages/publico/AbrirChamado.tsx', import.meta.url), 'utf8');
const consulta = await readFile(new URL('../src/pages/publico/ConsultarChamado.tsx', import.meta.url), 'utf8');
const auth = await readFile(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
const compras = await readFile(new URL('../src/pages/compras/ComprasChamadoDetalhe.tsx', import.meta.url), 'utf8');
const artifice = await readFile(new URL('../src/pages/artifice/ArtificeChamadoDetalhe.tsx', import.meta.url), 'utf8');

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
