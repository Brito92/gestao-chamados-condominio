# Auditoria do fluxo de chamados

## Fluxo validado

`MORADOR_ABRE_CHAMADO (EM_ANALISE) -> EM_COMPRAS -> AGUARDANDO_EXECUCAO -> EM_ANDAMENTO -> FINALIZADO`.

Saídas previstas: `REJEITADO` e `CANCELADO`. Chamados finalizados podem retornar a `EM_ANALISE` pela RPC de reabertura, quando a configuração estiver habilitada.

## Correções implementadas

- Protocolo gerado na abertura, exibido imediatamente na tela de sucesso e preenchido retroativamente em registros antigos.
- E-mail obrigatório e validado na abertura, com tela de revisão antes do envio.
- Rejeição com motivo e anexo disponível na consulta pública.
- Reabertura configurável em `configuracoes_sistema`, protegida por número + contato do morador.
- Confirmação explícita para aprovação, rejeição, troca de artífice e conclusão.
- Locks atômicos `assumir_chamado`/`liberar_chamado` para Compras e Artífice, com expiração de 15 minutos.
- Compras e Artífice só editam após assumir o chamado; o artífice pode liberar chamados aguardando execução.
- Artífice não recebe orçamento nem comprovante de compra na tela.
- Motivo de não execução obrigatório e histórico do artífice filtrado pelo responsável.
- Observações separadas por etapa; o histórico não reutiliza a observação do admin nas etapas seguintes.
- Histórico com evento, responsável e detalhes; atribuições e locks também deixam rastros.
- Nome, e-mail e WhatsApp do solicitante visíveis a Compras e Artífice.
- Última atualização visível nos cartões, filtro de data no admin e alerta de SLA por etapa.
- Gasto total considera somente anexos de comprovante de compra com valor.
- Dashboard respeita o condomínio do admin comum e mantém filtro manual para admin master.
- Retorno à aba/app não desmonta o formulário quando o Supabase renova ou reemite a mesma sessão.

## Arquivos principais

- `supabase/migrations/0013_auditoria_fluxo_concorrencia.sql`: schema, state machine, RPCs, policies, auditoria e compatibilidade.
- `frontend/src/context/AuthContext.tsx`: correção de reidratação da sessão.
- `frontend/src/pages/publico/AbrirChamado.tsx`: e-mail, revisão e protocolo.
- `frontend/src/pages/publico/ConsultarChamado.tsx`: anexos públicos e reabertura.
- `frontend/src/pages/compras/ComprasChamadoDetalhe.tsx` e `frontend/src/pages/artifice/ArtificeChamadoDetalhe.tsx`: locks e regras por etapa.
- `frontend/src/utils/fluxoChamado.ts`: validação de e-mail, SLA e gastos.

## Testes

- `frontend/tests/auditoria-fluxo.test.mjs`: regressões automatizadas sem dependências externas, executadas com `npm test`.
- `supabase/tests/0013_auditoria_fluxo.sql`: asserções de schema, transição e RPCs para SQL Editor/CI.
- `git diff --check`: aprovado.

Neste ambiente, `node`, `npm`, `tsc`, Supabase CLI e `psql` não estão instalados; por isso não foi possível executar o build, os testes Node ou aplicar as migrations contra um banco real. A validação final deve ser feita após aplicar as migrations em um projeto Supabase de homologação.

## Riscos remanescentes

- Arquivos selecionados em formulários não podem ser serializados pelo `localStorage`; textos e seleções são preservados. Se o sistema realmente recarregar a WebView inteira, os anexos precisam de persistência em IndexedDB ou reenvio.
- O envio de notificações por WhatsApp/e-mail continua fora do escopo do frontend; o banco preserva os contatos e o protocolo.
- A política de exclusão de condomínio mantém a inativação como operação principal para não quebrar chamados vinculados por FK.
