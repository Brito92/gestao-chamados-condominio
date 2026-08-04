import type { StatusChamado } from '@/types/database';
import { ETAPAS_FLUXO_PRINCIPAL, STATUS_META } from '@/utils/statusChamado';

/**
 * Mostra visualmente em que ponto do fluxo "feliz" o chamado está.
 * Para estados terminais alternativos (REJEITADO, CANCELADO) mostra um
 * aviso dedicado em vez da barra, já que eles saem do fluxo principal.
 */
export function ProgressoChamado({ status }: { status: StatusChamado }) {
  if (status === 'REJEITADO' || status === 'CANCELADO') {
    const meta = STATUS_META[status];
    return (
      <div className={`rounded-xl border border-red-200 ${meta.corBadge} p-4`}>
        <p className={`font-semibold ${meta.corTexto}`}>{meta.label}</p>
        <p className="text-sm text-ardosia-600 mt-1">{meta.descricao}</p>
      </div>
    );
  }

  const indiceAtual = ETAPAS_FLUXO_PRINCIPAL.indexOf(status);

  return (
    <div className="w-full">
      <div className="flex items-center">
        {ETAPAS_FLUXO_PRINCIPAL.map((etapa, i) => {
          const concluida = i < indiceAtual;
          const atual = i === indiceAtual;
          return (
            <div key={etapa} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 ${
                    concluida
                      ? 'bg-ardosia-600 border-ardosia-600'
                      : atual
                        ? 'bg-ambar-500 border-ambar-500 ring-4 ring-ambar-100'
                        : 'bg-white border-ardosia-200'
                  }`}
                />
              </div>
              {i < ETAPAS_FLUXO_PRINCIPAL.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 ${concluida ? 'bg-ardosia-600' : 'bg-ardosia-200'}`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm font-medium text-ardosia-800">
        {STATUS_META[status].label}
      </p>
      <p className="text-xs text-ardosia-500">{STATUS_META[status].descricao}</p>
    </div>
  );
}
