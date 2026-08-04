import type { StatusChamado } from '@/types/database';
import { STATUS_META } from '@/utils/statusChamado';

export function StatusBadge({ status }: { status: StatusChamado }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${meta.corBadge} ${meta.corTexto}`}
    >
      {meta.label}
    </span>
  );
}
