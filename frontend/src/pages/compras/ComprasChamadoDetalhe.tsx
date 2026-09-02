import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LayoutInterno } from '@/components/LayoutInterno';
import { BackButton } from '@/components/BackButton';
import { CampoFoto } from '@/components/CampoFoto';
import { VisualizadorImagem } from '@/components/VisualizadorImagem';
import { useChamadoCompleto } from '@/hooks/useChamadoCompleto';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { enviarAnexoChamado } from '@/utils/uploadAnexo';
import { sanitizarTextoPlano, validarTextoLivre } from '@/utils/sanitizar';
import { validarOrigemDaAcao } from '@/utils/csrf';
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';
import { HistoricoChamado } from '@/components/HistoricoChamado';
import type { Usuario } from '@/types/database';

type Modo = 'menu' | 'com_compra' | 'sem_compra';

export function ComprasChamadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { chamado, carregando, erro, recarregar } = useChamadoCompleto({ id });

  const [modo, setModo, limparModo] = usePersistedState<Modo>(`rascunho:compras:modo:${id ?? ''}`, 'menu');
  const [orcamento, setOrcamento] = useState<File | null>(null);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [valor, setValor, limparValor] = usePersistedState(`rascunho:compras:valor:${id ?? ''}`, '');
  const [justificativa, setJustificativa, limparJustificativa] = usePersistedState(`rascunho:compras:justificativa:${id ?? ''}`, '');
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [artifices, setArtifices] = useState<Usuario[]>([]);
  const [carregandoArtifices, setCarregandoArtifices] = useState(false);
  const [artificeId, setArtificeId, limparArtifice] = usePersistedState<string | null>(`rascunho:compras:artifice:${id ?? ''}`, null);

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
    if (!chamado || !window.confirm('Liberar este chamado para outro comprador?')) return;
    setProcessando(true);
    const { error } = await supabase.rpc('liberar_chamado', { p_chamado_id: chamado.id });
    if (error) setErroAcao(error.message);
    else {
      setModo('menu');
      await recarregar();
    }
    setProcessando(false);
  }

  // Carrega lista de artífices quando modal de decisão abre
  useEffect(() => {
    if (modo === 'com_compra' || modo === 'sem_compra') {
      carregarArtifices();
      // Pré-seleciona se já existe artifice_id
      if (chamado?.artifice_id) {
        setArtificeId(chamado.artifice_id);
      }
    }
  }, [modo, chamado?.artifice_id, chamado?.condominio_id]);

  async function carregarArtifices() {
    if (!chamado) return;
    setCarregandoArtifices(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('papel', 'ARTIFICE')
        .eq('ativo', true)
        .eq('condominio_id', chamado.condominio_id)
        .order('nome', { ascending: true });
      if (error) throw error;
      setArtifices(data ?? []);
    } catch (err) {
      console.error('Erro ao carregar artífices:', err);
    } finally {
      setCarregandoArtifices(false);
    }
  }

  async function avancarComCompra() {
    if (!chamado) return;
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) {
      setErroAcao(erroOrigem);
      return;
    }
    if (!comprovante) {
      setErroAcao('Anexe o comprovante da compra para prosseguir.');
      return;
    }
    const valorNumerico = valor.trim() ? Number(valor.replace('.', '').replace(',', '.')) : null;
    if (valor.trim() && (valorNumerico === null || !Number.isFinite(valorNumerico) || valorNumerico < 0)) {
      setErroAcao('Informe um valor de compra válido.');
      return;
    }
    if (artificeId && artificeId !== chamado.artifice_id && !window.confirm('Trocar o artífice responsável? A alteração ficará registrada no histórico.')) return;
    setProcessando(true);
    setErroAcao(null);
    try {
      if (orcamento) {
        await enviarAnexoChamado({
          chamadoId: chamado.id,
          arquivo: orcamento,
          tipo: 'ORCAMENTO',
          enviadoPor: usuario?.id,
        });
      }
      await enviarAnexoChamado({
        chamadoId: chamado.id,
        arquivo: comprovante,
        tipo: 'COMPROVANTE_COMPRA',
          enviadoPor: usuario?.id,
          descricao: valor ? `Valor: R$ ${valor}` : undefined,
          valor: valorNumerico,
      });

      const updateData: Record<string, unknown> = {
        status: 'AGUARDANDO_EXECUCAO',
        compras_por: usuario?.id ?? null,
      };

      // Se compras atribuiu um artífice, incluir na atualização
      if (artificeId && artificeId !== chamado.artifice_id) {
        updateData.artifice_id = artificeId;
        updateData.artifice_atribuido_por = usuario?.id ?? null;
        updateData.artifice_atribuido_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from('chamados')
        .update(updateData)
        .eq('id', chamado.id);
      if (error) throw error;

      limparModo();
      limparValor();
      limparJustificativa();
      limparArtifice();
      navigate('/interno/compras');
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível concluir a compra.');
    } finally {
      setProcessando(false);
    }
  }

  async function avancarSemCompra() {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) {
      setErroAcao(erroOrigem);
      return;
    }
    if (!chamado) return;
    const erroJustificativa = validarTextoLivre(justificativa, 'A justificativa');
    if (erroJustificativa) {
      setErroAcao(erroJustificativa);
      return;
    }
    if (!justificativa.trim()) {
      setErroAcao('Explique por que este chamado não precisa de compra de materiais.');
      return;
    }
    if (artificeId && artificeId !== chamado.artifice_id && !window.confirm('Atribuir este chamado a outro artífice? A alteração ficará registrada no histórico.')) return;
    setProcessando(true);
    setErroAcao(null);
    try {
      const updateData: Record<string, unknown> = {
        status: 'AGUARDANDO_EXECUCAO',
        compras_por: usuario?.id ?? null,
        observacao_compras: sanitizarTextoPlano(justificativa).trim(),
      };

      // Se compras atribuiu um artífice, incluir na atualização
      if (artificeId && artificeId !== chamado.artifice_id) {
        updateData.artifice_id = artificeId;
        updateData.artifice_atribuido_por = usuario?.id ?? null;
        updateData.artifice_atribuido_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from('chamados')
        .update(updateData)
        .eq('id', chamado.id);
      if (error) throw error;
      limparModo();
      limparValor();
      limparJustificativa();
      limparArtifice();
      navigate('/interno/compras');
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível avançar o chamado.');
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

        <div className="card flex flex-col gap-3">
          <div>
            <p className="text-xs text-ardosia-400">Solicitante</p>
            <p className="font-semibold text-ardosia-800">{chamado.morador_nome}</p>
            <p className="text-sm text-ardosia-500">Contato: {chamado.morador_whatsapp}</p>
            {chamado.morador_email && <p className="text-sm text-ardosia-500">E-mail: {chamado.morador_email}</p>}
            {chamado.artifice && <p className="text-sm text-ambar-700 mt-1">Artífice atribuído: {chamado.artifice.nome}</p>}
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

        {!possuiLock && (
          <div className="card flex flex-col gap-2 border-ambar-500/40">
            <p className="text-sm text-ardosia-700">{bloqueadoPorOutro ? 'Este chamado está sendo atendido por outro comprador.' : 'Assuma o chamado para editar e avançar a etapa.'}</p>
            {!bloqueadoPorOutro && <button className="btn-primario" onClick={assumir} disabled={processando}>{processando ? 'Assumindo...' : 'Assumir atendimento'}</button>}
          </div>
        )}

        {possuiLock && modo === 'menu' && (
          <div className="flex flex-col gap-2">
            <button className="btn-primario" onClick={() => setModo('com_compra')}>
              Registrar material comprado
            </button>
            <button className="btn-secundario" onClick={() => setModo('sem_compra')}>
              Não precisa de compra — avançar direto
            </button>
            <button className="btn-secundario" onClick={liberar} disabled={processando}>Liberar chamado</button>
          </div>
        )}

        {possuiLock && modo === 'com_compra' && (
          <div className="card flex flex-col gap-3">
            <CampoFoto
              label="Orçamento (opcional)"
              arquivo={orcamento}
              onChange={setOrcamento}
              accept="application/pdf,image/jpeg,image/png"
            />
            <CampoFoto
              label="Comprovante da compra"
              arquivo={comprovante}
              onChange={setComprovante}
              accept="application/pdf,image/jpeg,image/png"
              obrigatorio
            />
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Valor gasto (R$)
              </span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Atribuir artífice (opcional)
              </span>
              <select
                className="input"
                value={artificeId ?? ''}
                onChange={(e) => setArtificeId(e.target.value || null)}
                disabled={carregandoArtifices}
              >
                <option value="">-- Selecione um artífice --</option>
                {artifices.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.nome}
                  </option>
                ))}
              </select>
            </label>
            {erroAcao && <p className="text-sm text-red-600">{erroAcao}</p>}
            <div className="flex gap-2">
              <button className="btn-secundario flex-1" onClick={() => setModo('menu')}>
                Voltar
              </button>
              <button
                className="btn-primario flex-1"
                onClick={avancarComCompra}
                disabled={processando}
              >
                {processando ? 'Enviando...' : 'Marcar como comprado'}
              </button>
            </div>
          </div>
        )}

        {possuiLock && modo === 'sem_compra' && (
          <div className="card flex flex-col gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Justificativa <span className="text-ambar-600">*</span>
              </span>
              <textarea
                className="input min-h-[90px]"
                placeholder="Ex: material já disponível no estoque do condomínio..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Atribuir artífice (opcional)
              </span>
              <select
                className="input"
                value={artificeId ?? ''}
                onChange={(e) => setArtificeId(e.target.value || null)}
                disabled={carregandoArtifices}
              >
                <option value="">-- Selecione um artífice --</option>
                {artifices.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.nome}
                  </option>
                ))}
              </select>
            </label>
            {erroAcao && <p className="text-sm text-red-600">{erroAcao}</p>}
            <div className="flex gap-2">
              <button className="btn-secundario flex-1" onClick={() => setModo('menu')}>
                Voltar
              </button>
              <button
                className="btn-primario flex-1"
                onClick={avancarSemCompra}
                disabled={processando}
              >
                {processando ? 'Enviando...' : 'Avançar chamado'}
              </button>
            </div>
          </div>
        )}
      </div>
    </LayoutInterno>
  );
}
