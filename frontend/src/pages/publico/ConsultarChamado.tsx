import { useState } from 'react';
import { LayoutPublico } from '@/components/LayoutPublico';
import { ProgressoChamado } from '@/components/ProgressoChamado';
import { HistoricoChamado } from '@/components/HistoricoChamado';
import { useChamadoCompleto } from '@/hooks/useChamadoCompleto';
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';

export function ConsultarChamado() {
  const [numeroBusca, setNumeroBusca] = useState('');
  const [numeroConsultado, setNumeroConsultado] = useState<string | undefined>(undefined);

  const { chamado, carregando, erro } = useChamadoCompleto({ numeroChamado: numeroConsultado });

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
              <HistoricoChamado historico={chamado.historico} />
            </div>
          </div>
        )}
      </div>
    </LayoutPublico>
  );
}
