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

export function HistoricoChamado({ historico }: { historico: ChamadoHistorico[] }) {
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
          <p className="text-xs text-ardosia-400">{formatarData(item.criado_em)}</p>
          {item.usuario && (
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
