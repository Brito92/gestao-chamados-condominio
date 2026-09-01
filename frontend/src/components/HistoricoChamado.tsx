import type { ChamadoHistorico } from '@/types/database';
import { STATUS_META } from '@/utils/statusChamado';

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoricoChamado({ historico, mostrarResponsavel = true }: { historico: ChamadoHistorico[]; mostrarResponsavel?: boolean }) {
  const ordenado = [...historico].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
  );

  return (
    <ol className="relative border-l border-ardosia-200 ml-2.5">
      {ordenado.map((item) => (
        <li key={item.id} className="mb-5 ml-5 last:mb-0">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-ardosia-500" />
          <p className="text-sm font-semibold text-ardosia-800">
            {STATUS_META[item.status_novo].label}
          </p>
          {item.evento && item.evento !== 'STATUS' && (
            <p className="text-xs font-medium text-ambar-700">{rotuloEvento(item.evento)}</p>
          )}
          <p className="text-xs text-ardosia-400">{formatarData(item.criado_em)}</p>
          {mostrarResponsavel && item.usuario && (
            <p className="text-xs text-ardosia-500 mt-0.5">Responsável: {item.usuario.nome}</p>
          )}
          {item.observacao && (
            <p className="text-sm text-ardosia-600 mt-1 bg-ardosia-50 rounded-lg p-2 border border-ardosia-100">
              {item.observacao}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function rotuloEvento(evento: string) {
  const rotulos: Record<string, string> = {
    ABERTURA: 'Abertura',
    ATRIBUICAO: 'Atribuição de responsável',
    ATENDIMENTO: 'Lock de atendimento',
    OBSERVACAO: 'Atualização/observação',
    REABERTURA: 'Reabertura solicitada pelo morador',
  };
  return rotulos[evento] ?? evento;
}
