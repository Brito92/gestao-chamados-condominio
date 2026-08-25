import { useEffect, useState } from 'react';
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
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';
import type { Usuario } from '@/types/database';

type Acao = 'aprovar' | 'rejeitar' | null;

export function AdminSolicitacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { chamado, carregando, erro } = useChamadoCompleto({ id });

  const [acao, setAcao] = useState<Acao>(null);
  const [motivo, setMotivo, limparMotivo] = usePersistedState(`rascunho:admin:motivo:${id ?? ''}`, '');
  const [observacaoAprovacao, setObservacaoAprovacao, limparObservacao] = usePersistedState(`rascunho:admin:observacao:${id ?? ''}`, '');
  const [anexoRejeicao, setAnexoRejeicao] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [artifices, setArtifices] = useState<Usuario[]>([]);
  const [artificeId, setArtificeId] = useState('');

  useEffect(() => {
    if (!chamado) return;
    supabase
      .from('usuarios')
      .select('*')
      .eq('papel', 'ARTIFICE')
      .eq('ativo', true)
      .eq('condominio_id', chamado.condominio_id)
      .order('nome')
      .returns<Usuario[]>()
      .then(({ data }) => setArtifices(data ?? []));
  }, [chamado?.condominio_id]);

  async function aprovar() {
    if (!chamado) return;
    setProcessando(true);
    setErroAcao(null);
    try {
      const updateData: Record<string, unknown> = {
        status: 'EM_COMPRAS',
        aprovado_por: usuario?.id ?? null,
      };
      
      // Só inclui observacao_aprovacao se foi preenchida
      if (observacaoAprovacao.trim()) {
        updateData.observacao_aprovacao = observacaoAprovacao.trim();
      }
      if (artificeId) {
        updateData.artifice_id = artificeId;
        updateData.artifice_atribuido_por = usuario?.id ?? null;
        updateData.artifice_atribuido_em = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('chamados')
        .update(updateData)
        .eq('id', chamado.id);
      if (error) throw error;
      limparObservacao();
      navigate('/interno/admin/solicitacoes');
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível aprovar.');
    } finally {
      setProcessando(false);
    }
  }

  async function rejeitar() {
    if (!chamado) return;
    if (!motivo.trim()) {
      setErroAcao('Informe o motivo da rejeição.');
      return;
    }
    setProcessando(true);
    setErroAcao(null);
    try {
      const { error } = await supabase
        .from('chamados')
        .update({
          status: 'REJEITADO',
          motivo_rejeicao: motivo.trim(),
          aprovado_por: usuario?.id ?? null,
        })
        .eq('id', chamado.id);
      if (error) throw error;

      if (anexoRejeicao) {
        await enviarAnexoChamado({
          chamadoId: chamado.id,
          arquivo: anexoRejeicao,
          tipo: 'ANEXO_REJEICAO',
          enviadoPor: usuario?.id,
        });
      }

      navigate('/interno/admin/solicitacoes');
      limparMotivo();
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível rejeitar.');
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) {
    return (
      <LayoutInterno titulo="Solicitação">
        <BackButton />
        <p className="text-sm text-ardosia-400">Carregando...</p>
      </LayoutInterno>
    );
  }

  if (erro || !chamado) {
    return (
      <LayoutInterno titulo="Solicitação">
        <BackButton />
        <p className="text-sm text-red-600">{erro ?? 'Solicitação não encontrada.'}</p>
      </LayoutInterno>
    );
  }

  const foto = chamado.anexos.find((a) => a.tipo === 'FOTO_SOLICITACAO');

  return (
    <LayoutInterno titulo={`Solicitação ${chamado.numero_chamado ? `#${chamado.numero_chamado}` : '(sem número)'}`}>
      <div className="flex flex-col gap-4">
        <BackButton />

        <div className="card flex flex-col gap-3">
          <div>
            <p className="text-xs text-ardosia-400">Morador</p>
            <p className="font-semibold text-ardosia-800">{chamado.morador_nome}</p>
            <p className="text-sm text-ardosia-500">{chamado.morador_whatsapp}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-ardosia-400">Local</p>
              <p className="text-sm font-medium text-ardosia-700">{chamado.local_problema}</p>
            </div>
            <div>
              <p className="text-xs text-ardosia-400">Tipo</p>
              <p className="text-sm font-medium text-ardosia-700">
                {TIPO_PROBLEMA_LABEL[chamado.tipo_problema]}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-ardosia-400">Descrição</p>
            <p className="text-sm text-ardosia-600">{chamado.descricao}</p>
          </div>
          {foto && (
            <div>
              <p className="text-xs text-ardosia-400 mb-2">Foto anexada</p>
              <VisualizadorImagem
                url={foto.url}
                alt="Foto do problema relatado"
                className="rounded-xl border border-ardosia-100 max-h-56 object-cover w-full"
              />
            </div>
          )}
        </div>

        {acao === null && (
          <div className="flex flex-col gap-2">
            <button className="btn-primario" onClick={() => setAcao('aprovar')}>
              Aprovar e enviar para compras
            </button>
            <button className="btn-perigo" onClick={() => setAcao('rejeitar')}>
              Rejeitar solicitação
            </button>
          </div>
        )}

        {acao === 'aprovar' && (
          <div className="card flex flex-col gap-3">
            <p className="text-sm text-ardosia-600">
              Ao aprovar, um número de chamado será gerado e o morador será notificado via
              WhatsApp para acompanhar o andamento.
            </p>
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Observação (opcional)
              </span>
              <textarea
                className="input min-h-[70px]"
                placeholder="Adicione observações para as próximas etapas (compras, artífice)..."
                value={observacaoAprovacao}
                onChange={(e) => setObservacaoAprovacao(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Atribuir artífice (opcional)
              </span>
              <select className="input" value={artificeId} onChange={(e) => setArtificeId(e.target.value)}>
                <option value="">-- Selecionar depois --</option>
                {artifices.map((artifice) => (
                  <option key={artifice.id} value={artifice.id}>{artifice.nome}</option>
                ))}
              </select>
            </label>
            {erroAcao && <p className="text-sm text-red-600">{erroAcao}</p>}
            <div className="flex gap-2">
              <button className="btn-secundario flex-1" onClick={() => setAcao(null)}>
                Voltar
              </button>
              <button className="btn-primario flex-1" onClick={aprovar} disabled={processando}>
                {processando ? 'Aprovando...' : 'Confirmar aprovação'}
              </button>
            </div>
          </div>
        )}

        {acao === 'rejeitar' && (
          <div className="card flex flex-col gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Motivo da rejeição <span className="text-ambar-600">*</span>
              </span>
              <textarea
                className="input min-h-[90px]"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explique por que esta solicitação está sendo rejeitada..."
              />
            </label>
            <CampoFoto
              label="Anexo (opcional)"
              arquivo={anexoRejeicao}
              onChange={setAnexoRejeicao}
            />
            {erroAcao && <p className="text-sm text-red-600">{erroAcao}</p>}
            <div className="flex gap-2">
              <button className="btn-secundario flex-1" onClick={() => setAcao(null)}>
                Voltar
              </button>
              <button className="btn-perigo flex-1" onClick={rejeitar} disabled={processando}>
                {processando ? 'Rejeitando...' : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        )}
      </div>
    </LayoutInterno>
  );
}
