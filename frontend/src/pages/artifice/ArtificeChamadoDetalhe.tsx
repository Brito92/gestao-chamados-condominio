import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LayoutInterno } from '@/components/LayoutInterno';
import { BackButton } from '@/components/BackButton';
import { CampoFoto } from '@/components/CampoFoto';
import { VisualizadorImagem } from '@/components/VisualizadorImagem';
import { ProgressoChamado } from '@/components/ProgressoChamado';
import { useChamadoCompleto } from '@/hooks/useChamadoCompleto';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { enviarAnexoChamado } from '@/utils/uploadAnexo';
import { sanitizarTextoPlano, validarTextoLivre } from '@/utils/sanitizar';
import { validarOrigemDaAcao } from '@/utils/csrf';
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';
import { HistoricoChamado } from '@/components/HistoricoChamado';

type ModoAcao = 'normal' | 'marcar_nao_executado';

export function ArtificeChamadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { chamado, carregando, erro, recarregar } = useChamadoCompleto({ id });

  const [fotoAntes, setFotoAntes] = useState<File | null>(null);
  const [fotoDepois, setFotoDepois] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [observacao, setObservacao, limparObservacao] = usePersistedState(`rascunho:artifice:observacao:${id ?? ''}`, '');
  const [modoAcao, setModoAcao] = usePersistedState<ModoAcao>(`rascunho:artifice:modo:${id ?? ''}`, 'normal');
  const [motivoNaoExecucao, setMotivoNaoExecucao, limparMotivoNaoExecucao] = usePersistedState(`rascunho:artifice:nao-executado:${id ?? ''}`, '');

  async function assumir() {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) {
      setErroAcao(erroOrigem);
      return;
    }
    if (!chamado) return;
    setProcessando(true);
    setErroAcao(null);
    const { error } = await supabase.rpc('assumir_chamado', { p_chamado_id: chamado.id });
    if (error) setErroAcao(error.message);
    else await recarregar();
    setProcessando(false);
  }

  async function liberar() {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) {
      setErroAcao(erroOrigem);
      return;
    }
    if (!chamado || !window.confirm('Liberar este chamado para outro artífice?')) return;
    setProcessando(true);
    const { error } = await supabase.rpc('liberar_chamado', { p_chamado_id: chamado.id });
    if (error) setErroAcao(error.message);
    else await recarregar();
    setProcessando(false);
  }

  async function iniciarExecucao() {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) {
      setErroAcao(erroOrigem);
      return;
    }
    if (!chamado || !usuario) return;
    if (chamado.assumido_por !== usuario.id) {
      setErroAcao('Assuma o chamado antes de iniciar a execução.');
      return;
    }
    setProcessando(true);
    setErroAcao(null);
    try {
      const { error } = await supabase
        .from('chamados')
        .update({ status: 'EM_ANDAMENTO', artifice_id: usuario.id })
        .eq('id', chamado.id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível iniciar a execução.');
    } finally {
      setProcessando(false);
    }
  }

  async function salvarObservacao() {
    const erroOrigem = validarOrigemDaAcao();
    const erroObservacao = validarTextoLivre(observacao, 'A observação');
    if (erroOrigem || erroObservacao) {
      setErroAcao(erroOrigem ?? erroObservacao);
      return;
    }
    if (!chamado) return;
    if (!usuario || chamado.assumido_por !== usuario.id) {
      setErroAcao('Assuma o chamado antes de registrar uma observação.');
      return;
    }
    setProcessando(true);
    setErroAcao(null);
    try {
      const { error } = await supabase
        .from('chamados')
        .update({ observacao_artifice: sanitizarTextoPlano(observacao).trim() || null })
        .eq('id', chamado.id);
      if (error) throw error;
      await recarregar();
      limparObservacao();
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível salvar a observação.');
    } finally {
      setProcessando(false);
    }
  }

  async function marcarNaoExecutado() {
    const erroOrigem = validarOrigemDaAcao();
    const erroMotivo = validarTextoLivre(motivoNaoExecucao, 'O motivo');
    if (erroOrigem || erroMotivo) {
      setErroAcao(erroOrigem ?? erroMotivo);
      return;
    }
    if (!chamado) return;
    if (!motivoNaoExecucao.trim()) {
      setErroAcao('Informe o motivo por não executar o serviço.');
      return;
    }
    if (!usuario || chamado.assumido_por !== usuario.id) {
      setErroAcao('Assuma o chamado antes de atualizar a execução.');
      return;
    }
    setProcessando(true);
    setErroAcao(null);
    try {
      const { error } = await supabase
        .from('chamados')
        .update({
          executado: false,
          motivo_nao_execucao: sanitizarTextoPlano(motivoNaoExecucao).trim(),
          status: 'FINALIZADO',
        })
        .eq('id', chamado.id);
      if (error) throw error;
      limparMotivoNaoExecucao();
      navigate('/interno/artifice');
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível marcar como não executado.');
    } finally {
      setProcessando(false);
    }
  }

  async function finalizarExecucao() {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) {
      setErroAcao(erroOrigem);
      return;
    }
    if (!chamado) return;
    if (!fotoDepois) {
      setErroAcao('Anexe a foto do "depois" para concluir o chamado.');
      return;
    }
    if (!usuario || chamado.assumido_por !== usuario.id) {
      setErroAcao('Assuma o chamado antes de concluir a execução.');
      return;
    }
    if (!window.confirm('Confirmar a conclusão deste chamado?')) return;
    setProcessando(true);
    setErroAcao(null);
    try {
      if (fotoAntes) {
        await enviarAnexoChamado({
          chamadoId: chamado.id,
          arquivo: fotoAntes,
          tipo: 'FOTO_ANTES',
          enviadoPor: usuario?.id,
        });
      }
      await enviarAnexoChamado({
        chamadoId: chamado.id,
        arquivo: fotoDepois,
        tipo: 'FOTO_DEPOIS',
        enviadoPor: usuario?.id,
      });

      const { error } = await supabase
        .from('chamados')
        .update({ status: 'FINALIZADO' })
        .eq('id', chamado.id);
      if (error) throw error;

      limparObservacao();
      navigate('/interno/artifice');
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível finalizar o chamado.');
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) {
    return (
      <LayoutInterno titulo="Chamado">
        <BackButton />
        <p className="text-sm text-ardosia-400">Carregando...</p>
      </LayoutInterno>
    );
  }

  if (erro || !chamado) {
    return (
      <LayoutInterno titulo="Chamado">
        <BackButton />
        <p className="text-sm text-red-600">{erro ?? 'Chamado não encontrado.'}</p>
      </LayoutInterno>
    );
  }

  const possuiLock = chamado.assumido_por === usuario?.id &&
    (!chamado.bloqueio_expira_em || new Date(chamado.bloqueio_expira_em).getTime() > Date.now());
  const bloqueadoPorOutro = Boolean(chamado.assumido_por && !possuiLock);

  return (
    <LayoutInterno titulo={chamado.numero_chamado ? `Chamado #${chamado.numero_chamado}` : 'Chamado'}>
      <div className="flex flex-col gap-4">
        <BackButton />

        <div className="card">
          <ProgressoChamado status={chamado.status} />
        </div>

        <div className="card flex flex-col gap-3">
          <div>
            <p className="text-xs text-ardosia-400">Solicitante</p>
            <p className="font-semibold text-ardosia-800">{chamado.morador_nome}</p>
            <p className="text-sm text-ardosia-500">Contato: {chamado.morador_whatsapp}</p>
            {chamado.morador_email && <p className="text-sm text-ardosia-500">E-mail: {chamado.morador_email}</p>}
          </div>
          <div>
            <p className="font-semibold text-ardosia-800">{chamado.local_problema}</p>
            <p className="text-xs text-ardosia-400">
              {TIPO_PROBLEMA_LABEL[chamado.tipo_problema]}
            </p>
            <p className="text-sm text-ardosia-600">{chamado.descricao}</p>
          </div>
          {chamado.observacao_aprovacao && (
            <div className="bg-ambar-50 border border-ambar-200 rounded-lg p-3">
              <p className="text-xs text-ambar-600 font-medium mb-1">Observação do admin</p>
              <p className="text-sm text-ambar-800">{chamado.observacao_aprovacao}</p>
            </div>
          )}
          {chamado.observacao_compras && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">Observação de compras</p>
              <p className="text-sm text-blue-800">{chamado.observacao_compras}</p>
            </div>
          )}
          {chamado.observacao_artifice && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs text-emerald-600 font-medium mb-1">Observação do artífice</p>
              <p className="text-sm text-emerald-800">{chamado.observacao_artifice}</p>
            </div>
          )}
          {chamado.anexos.filter(a => a.tipo === 'FOTO_SOLICITACAO').map((foto) => (
            <div key={foto.id}>
              <p className="text-xs text-ardosia-400 mb-2">Foto da solicitação</p>
              <VisualizadorImagem
                url={foto.url}
                alt="Foto do problema relatado"
                className="rounded-xl border border-ardosia-100 max-h-56 object-cover w-full"
              />
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs text-ardosia-400 mb-2">Histórico de atualizações</p>
          <div className="card"><HistoricoChamado historico={chamado.historico} /></div>
        </div>

        {!possuiLock && chamado.status !== 'FINALIZADO' && (
          <div className="card flex flex-col gap-2 border-ambar-500/40">
            <p className="text-sm text-ardosia-700">{bloqueadoPorOutro ? 'Este chamado está sendo atendido por outro artífice.' : 'Assuma o chamado para iniciar ou atualizar a execução.'}</p>
            {!bloqueadoPorOutro && <button className="btn-primario" onClick={assumir} disabled={processando}>{processando ? 'Assumindo...' : 'Assumir atendimento'}</button>}
          </div>
        )}

        {possuiLock && chamado.status === 'AGUARDANDO_EXECUCAO' && (
          <div className="flex flex-col gap-2">
            {erroAcao && <p className="text-sm text-red-600">{erroAcao}</p>}
            <button className="btn-primario" onClick={iniciarExecucao} disabled={processando}>
              {processando ? 'Iniciando...' : 'Iniciar execução'}
            </button>
            <button className="btn-secundario" onClick={liberar} disabled={processando}>Liberar chamado</button>
          </div>
        )}

        {possuiLock && chamado.status === 'EM_ANDAMENTO' && modoAcao === 'normal' && (
          <div className="card flex flex-col gap-3">
            <p className="text-sm text-ardosia-600">
              Registre as fotos de antes e depois para concluir o chamado.
            </p>
            <CampoFoto label="Foto do antes" arquivo={fotoAntes} onChange={setFotoAntes} />
            <CampoFoto
              label="Foto do depois"
              arquivo={fotoDepois}
              onChange={setFotoDepois}
              obrigatorio
            />
            {erroAcao && <p className="text-sm text-red-600">{erroAcao}</p>}
            <div className="flex gap-2">
              <button
                className="btn-primario flex-1"
                onClick={finalizarExecucao}
                disabled={processando}
              >
                {processando ? 'Concluindo...' : 'Marcar como concluído'}
              </button>
              <button
                className="btn-perigo flex-1"
                onClick={() => setModoAcao('marcar_nao_executado')}
                disabled={processando}
              >
                Não foi executado
              </button>
            </div>
          </div>
        )}

        {possuiLock && chamado.status === 'EM_ANDAMENTO' && modoAcao === 'marcar_nao_executado' && (
          <div className="card flex flex-col gap-3">
            <p className="text-sm text-ardosia-700 font-semibold">Motivo da não execução</p>
            <label className="block">
              <textarea
                className="input min-h-[90px]"
                placeholder="Explique por que não foi possível executar o serviço..."
                value={motivoNaoExecucao}
                onChange={(e) => setMotivoNaoExecucao(e.target.value)}
              />
            </label>
            {erroAcao && <p className="text-sm text-red-600">{erroAcao}</p>}
            <div className="flex gap-2">
              <button
                className="btn-secundario flex-1"
                onClick={() => {
                  setModoAcao('normal');
                  setMotivoNaoExecucao('');
                  setErroAcao(null);
                }}
                disabled={processando}
              >
                Voltar
              </button>
              <button
                className="btn-perigo flex-1"
                onClick={marcarNaoExecutado}
                disabled={processando || !motivoNaoExecucao.trim()}
              >
                {processando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {possuiLock && chamado.status === 'EM_ANDAMENTO' && (
          <div className="card flex flex-col gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Observação (opcional)
              </span>
              <textarea
                className="input min-h-[70px]"
                placeholder="Adicione observações sobre o andamento do serviço..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </label>
            {erroAcao && modoAcao === 'normal' && (
              <p className="text-sm text-red-600">{erroAcao}</p>
            )}
            {observacao.trim() && (
              <button
                className="btn-secundario"
                onClick={salvarObservacao}
                disabled={processando}
              >
                {processando ? 'Salvando...' : 'Salvar observação'}
              </button>
            )}
          </div>
        )}

        {chamado.status === 'FINALIZADO' && (
          <div className="card bg-emerald-50 border-emerald-200 text-center">
            <p className="text-emerald-700 font-semibold">Chamado concluído ✓</p>
          </div>
        )}
      </div>
    </LayoutInterno>
  );
}
