import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LayoutInterno } from '@/components/LayoutInterno';
import { BackButton } from '@/components/BackButton';
import { ProgressoChamado } from '@/components/ProgressoChamado';
import { HistoricoChamado } from '@/components/HistoricoChamado';
import { useChamadoCompleto } from '@/hooks/useChamadoCompleto';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';
import { validarOrigemDaAcao } from '@/utils/csrf';
import type { Usuario } from '@/types/database';
import { AnexoImagemPrivada } from '@/components/AnexoImagemPrivada';

  const NAO_CANCELAVEL = new Set(['FINALIZADO', 'NAO_EXECUTADO', 'CANCELADO', 'REJEITADO']);

export function AdminChamadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const { chamado, carregando, erro, recarregar } = useChamadoCompleto({ id });
  const [cancelando, setCancelando] = useState(false);
  const [usuarioAtribuidor, setUsuarioAtribuidor] = useState<Usuario | null>(null);
  const [carregandoAtribuidor, setCarregandoAtribuidor] = useState(false);
  const [artifices, setArtifices] = useState<Usuario[]>([]);
  const [artificeSelecionado, setArtificeSelecionado] = useState('');
  const [salvandoArtifice, setSalvandoArtifice] = useState(false);
  const [erroArtifice, setErroArtifice] = useState<string | null>(null);

  // Carrega informação de quem atribuiu o artífice
  useEffect(() => {
    if (chamado?.artifice_atribuido_por) {
      carregarUsuarioAtribuidor();
    } else {
      setUsuarioAtribuidor(null);
    }
  }, [chamado?.artifice_atribuido_por]);

  useEffect(() => {
    if (!chamado) return;
    setArtificeSelecionado(chamado.artifice_id ?? '');
    supabase
      .from('usuarios')
      .select('*')
      .eq('papel', 'ARTIFICE')
      .eq('ativo', true)
      .eq('condominio_id', chamado.condominio_id)
      .order('nome')
      .returns<Usuario[]>()
      .then(({ data }) => setArtifices(data ?? []));
  }, [chamado?.id, chamado?.artifice_id, chamado?.condominio_id]);

  async function salvarArtifice() {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) {
      setErroArtifice(erroOrigem);
      return;
    }
    if (!chamado) return;
    if (artificeSelecionado !== (chamado.artifice_id ?? '') && !window.confirm('Trocar o artífice responsável? A alteração ficará registrada no histórico.')) return;
    setSalvandoArtifice(true);
    setErroArtifice(null);
    const { error } = await supabase.from('chamados').update({
      artifice_id: artificeSelecionado || null,
      artifice_atribuido_por: artificeSelecionado ? usuario?.id ?? null : null,
      artifice_atribuido_em: artificeSelecionado ? new Date().toISOString() : null,
    }).eq('id', chamado.id);
    if (error) setErroArtifice(error.message);
    else await recarregar();
    setSalvandoArtifice(false);
  }

  async function carregarUsuarioAtribuidor() {
    if (!chamado?.artifice_atribuido_por) return;
    setCarregandoAtribuidor(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', chamado.artifice_atribuido_por)
        .maybeSingle<Usuario>();
      if (error) throw error;
      setUsuarioAtribuidor(data);
    } catch (err) {
      console.error('Erro ao carregar usuário atribuidor:', err);
    } finally {
      setCarregandoAtribuidor(false);
    }
  }

  async function cancelarChamado() {
    if (validarOrigemDaAcao()) return;
    if (!chamado) return;
    if (!confirm('Cancelar este chamado por inconsistência ou duplicidade?')) return;
    setCancelando(true);
    await supabase.from('chamados').update({ status: 'CANCELADO' }).eq('id', chamado.id);
    await recarregar();
    setCancelando(false);
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

  return (
    <LayoutInterno titulo={chamado.numero_chamado ? `Chamado #${chamado.numero_chamado}` : 'Chamado'}>
      <div className="flex flex-col gap-4">
        <BackButton />

        <div className="card">
          <ProgressoChamado status={chamado.status} />
        </div>

        <div className="card flex flex-col gap-3">
          <div>
            <p className="text-xs text-ardosia-400">Morador</p>
            <p className="font-semibold text-ardosia-800">{chamado.morador_nome}</p>
            <p className="text-sm text-ardosia-500">{chamado.morador_whatsapp}</p>
            {chamado.morador_email && <p className="text-sm text-ardosia-500">{chamado.morador_email}</p>}
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
          {chamado.observacao_aprovacao && (
            <div className="bg-ambar-50 border border-ambar-200 rounded-lg p-3">
              <p className="text-xs text-ambar-600 font-medium mb-1">Observação do admin (aprovação)</p>
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
          {chamado.motivo_rejeicao && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600 font-medium mb-1">Motivo da rejeição</p>
              <p className="text-sm text-red-800">{chamado.motivo_rejeicao}</p>
            </div>
          )}
          {chamado.motivo_nao_execucao && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs text-orange-600 font-medium mb-1">Motivo da não execução</p>
              <p className="text-sm text-orange-800">{chamado.motivo_nao_execucao}</p>
            </div>
          )}
        </div>

        {!NAO_CANCELAVEL.has(chamado.status) && (
          <div className="card flex flex-col gap-2">
            <p className="text-xs text-ardosia-400">Responsável pela execução</p>
            <select className="input" value={artificeSelecionado} onChange={(e) => setArtificeSelecionado(e.target.value)}>
              <option value="">Sem artífice atribuído</option>
              {artifices.map((artifice) => (
                <option key={artifice.id} value={artifice.id}>{artifice.nome}</option>
              ))}
            </select>
            {erroArtifice && <p className="text-sm text-red-600">{erroArtifice}</p>}
            <button className="btn-secundario" onClick={salvarArtifice} disabled={salvandoArtifice}>
              {salvandoArtifice ? 'Salvando...' : 'Salvar responsável'}
            </button>
          </div>
        )}

        {chamado.artifice_id && (
          <div className="card flex flex-col gap-2">
            <div>
              <p className="text-xs text-ardosia-400">Artífice atribuído</p>
              <p className="text-sm font-medium text-ardosia-700">
                {artifices.find((item) => item.id === chamado.artifice_id)?.nome ?? chamado.artifice_id}
              </p>
            </div>
            {!carregandoAtribuidor && usuarioAtribuidor && (
              <div>
                <p className="text-xs text-ardosia-400">Atribuído por</p>
                <p className="text-sm text-ardosia-600">
                  {usuarioAtribuidor.nome}
                  {chamado.artifice_atribuido_em && (
                    <span className="text-xs text-ardosia-400 ml-2">
                      em{' '}
                      {new Date(chamado.artifice_atribuido_em).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {chamado.anexos.length > 0 && (
          <div className="card flex flex-col gap-3">
            <p className="text-xs text-ardosia-400 font-medium">Anexos ({chamado.anexos.length})</p>
            <div className="grid grid-cols-2 gap-3">
              {chamado.anexos.map((a) => (
                <div key={a.id} className="flex flex-col gap-2">
                  <p className="text-xs text-ardosia-500">
                    {a.tipo === 'FOTO_SOLICITACAO' && 'Foto da solicitação'}
                    {a.tipo === 'ANEXO_REJEICAO' && 'Anexo da rejeição'}
                    {a.tipo === 'ORCAMENTO' && 'Orçamento'}
                    {a.tipo === 'COMPROVANTE_COMPRA' && 'Comprovante de compra'}
                    {a.tipo === 'FOTO_ANTES' && 'Foto antes'}
                    {a.tipo === 'FOTO_DEPOIS' && 'Foto depois'}
                    {a.valor && ` - R$ ${a.valor}`}
                  </p>
                  <AnexoImagemPrivada
                    url={a.url}
                    alt={a.tipo}
                    className="rounded-lg border border-ardosia-100 h-32 w-full object-cover"
                  />
                  {a.descricao && (
                    <p className="text-xs text-ardosia-400">{a.descricao}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-ardosia-400 mb-2">Histórico</p>
          <div className="card">
            <HistoricoChamado historico={chamado.historico} />
          </div>
        </div>

        {!NAO_CANCELAVEL.has(chamado.status) && (
          <button className="btn-perigo" onClick={cancelarChamado} disabled={cancelando}>
            {cancelando ? 'Cancelando...' : 'Cancelar chamado'}
          </button>
        )}
      </div>
    </LayoutInterno>
  );
}
