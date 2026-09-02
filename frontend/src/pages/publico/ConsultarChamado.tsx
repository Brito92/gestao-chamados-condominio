import { useState } from 'react';
import { LayoutPublico } from '@/components/LayoutPublico';
import { ProgressoChamado } from '@/components/ProgressoChamado';
import { HistoricoChamado } from '@/components/HistoricoChamado';
import { useChamadoCompleto } from '@/hooks/useChamadoCompleto';
import { usePersistedState } from '@/hooks/usePersistedState';
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';
import { VisualizadorImagem } from '@/components/VisualizadorImagem';
import { supabase } from '@/lib/supabaseClient';
import { sanitizarTextoPlano, validarTextoLivre } from '@/utils/sanitizar';
import { validarOrigemDaAcao } from '@/utils/csrf';

export function ConsultarChamado() {
  const [numeroBusca, setNumeroBusca] = usePersistedState('rascunho:publico:consulta', '');
  const [numeroConsultado, setNumeroConsultado] = usePersistedState<string | null>(
    'rascunho:publico:consulta-enviada',
    null,
  );
  const [contatoReabertura, setContatoReabertura] = usePersistedState('rascunho:publico:reabertura-contato', '');
  const [motivoReabertura, setMotivoReabertura] = usePersistedState('rascunho:publico:reabertura-motivo', '');
  const [reabrindo, setReabrindo] = useState(false);
  const [erroReabertura, setErroReabertura] = useState<string | null>(null);
  const [reaberturaEnviada, setReaberturaEnviada] = useState(false);

  const { chamado, carregando, erro, recarregar } = useChamadoCompleto({ numeroChamado: numeroConsultado ?? undefined });

  async function solicitarReabertura() {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) {
      setErroReabertura(erroOrigem);
      return;
    }
    if (!numeroConsultado || !contatoReabertura.trim() || motivoReabertura.trim().length < 5) {
      setErroReabertura('Informe o contato usado na abertura e explique o motivo da reabertura.');
      return;
    }
    const erroMotivo = validarTextoLivre(motivoReabertura, 'O motivo da reabertura');
    if (erroMotivo) {
      setErroReabertura(erroMotivo);
      return;
    }
    setReabrindo(true);
    setErroReabertura(null);
    const { error: erroRpc } = await supabase.rpc('reabrir_chamado', {
      p_numero_chamado: numeroConsultado,
      p_contato: contatoReabertura.trim(),
      p_motivo: sanitizarTextoPlano(motivoReabertura).trim(),
    });
    if (erroRpc) setErroReabertura(erroRpc.message);
    else {
      setReaberturaEnviada(true);
      await recarregar();
    }
    setReabrindo(false);
  }

  return (
    <LayoutPublico titulo="Consultar chamado" voltarPara="/">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ardosia-500">
          Digite o número do chamado que você recebeu pelo WhatsApp após a aprovação da sua
          solicitação.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setNumeroConsultado(numeroBusca.trim());
          }}
          className="flex gap-2"
        >
          <input
            className="input flex-1 font-mono tracking-wide"
            placeholder="2026-000001"
            value={numeroBusca}
            onChange={(e) => setNumeroBusca(e.target.value)}
          />
          <button
            type="submit"
            className="bg-ardosia-800 text-white font-semibold rounded-xl px-5"
          >
            Buscar
          </button>
        </form>

        {carregando && numeroConsultado && (
          <p className="text-sm text-ardosia-400">Buscando chamado...</p>
        )}

        {!carregando && erro && numeroConsultado && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            Não encontramos nenhum chamado com este número. Verifique se digitou corretamente.
          </p>
        )}

        {!carregando && chamado && (
          <div className="bg-white rounded-2xl shadow-card border border-ardosia-100 p-4 flex flex-col gap-5 mt-2">
            <div>
              <p className="text-xs text-ardosia-400">Chamado</p>
              <p className="font-mono font-semibold text-lg text-ardosia-800">
                {chamado.numero_chamado}
              </p>
            </div>

            <ProgressoChamado status={chamado.status} />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ardosia-400">Local</p>
                <p className="text-ardosia-700 font-medium">{chamado.local_problema}</p>
              </div>
              <div>
                <p className="text-xs text-ardosia-400">Tipo</p>
                <p className="text-ardosia-700 font-medium">
                  {TIPO_PROBLEMA_LABEL[chamado.tipo_problema]}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-ardosia-400 mb-1">Descrição</p>
              <p className="text-sm text-ardosia-600">{chamado.descricao}</p>
            </div>

            {chamado.status === 'REJEITADO' && chamado.motivo_rejeicao && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Motivo da rejeição</p>
                <p className="text-sm text-red-700">{chamado.motivo_rejeicao}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-ardosia-400 mb-2">Histórico</p>
              {chamado.anexos.filter((a) => a.tipo === 'ANEXO_REJEICAO' || a.tipo === 'FOTO_DEPOIS').map((anexo) => (
                <div key={anexo.id} className="mb-4">
                  <p className="text-xs text-ardosia-400 mb-2">{anexo.tipo === 'ANEXO_REJEICAO' ? 'Anexo da rejeição' : 'Foto da conclusão'}</p>
                  <VisualizadorImagem url={anexo.url} alt="Anexo do chamado" className="rounded-xl border border-ardosia-100 max-h-56 object-cover w-full" />
                </div>
              ))}

              {chamado.status === 'FINALIZADO' && (
                <div className="card border border-ambar-300 bg-ambar-50 flex flex-col gap-3 mb-4">
                  <p className="text-sm font-semibold text-ardosia-800">Precisa de um novo atendimento?</p>
                  <p className="text-xs text-ardosia-600">A reabertura confirma sua identidade pelo contato informado na abertura.</p>
                  <input className="input" placeholder="E-mail ou WhatsApp usado na abertura" value={contatoReabertura} onChange={(e) => setContatoReabertura(e.target.value)} />
                  <textarea className="input min-h-[80px]" placeholder="Explique o motivo da reabertura" value={motivoReabertura} onChange={(e) => setMotivoReabertura(e.target.value)} />
                  {erroReabertura && <p className="text-sm text-red-600">{erroReabertura}</p>}
                  {reaberturaEnviada ? <p className="text-sm text-emerald-700 font-medium">Solicitação reaberta e enviada para análise.</p> : <button className="btn-primario" onClick={solicitarReabertura} disabled={reabrindo}>{reabrindo ? 'Enviando...' : 'Solicitar reabertura'}</button>}
                </div>
              )}

              <HistoricoChamado historico={chamado.historico} mostrarResponsavel={false} />
            </div>
          </div>
        )}
      </div>
    </LayoutPublico>
  );
}
