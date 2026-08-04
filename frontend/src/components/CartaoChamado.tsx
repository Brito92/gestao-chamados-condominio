import { Link } from 'react-router-dom';
import type { Chamado } from '@/types/database';
import { StatusBadge } from './StatusBadge';
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function CartaoChamado({ chamado, linkPara }: { chamado: Chamado; linkPara: string }) {
  return (
    <Link to={linkPara} className="card flex flex-col gap-2 active:bg-ardosia-50">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ardosia-400">
          {chamado.numero_chamado ?? 'Aguardando aprovação'}
        </span>
        <StatusBadge status={chamado.status} />
      </div>
      <p className="font-semibold text-ardosia-800">{chamado.local_problema}</p>
      <p className="text-sm text-ardosia-500 line-clamp-2">{chamado.descricao}</p>
      <div className="flex items-center justify-between text-xs text-ardosia-400 mt-1">
        <span>{TIPO_PROBLEMA_LABEL[chamado.tipo_problema]}</span>
        <span>Aberto em {formatarData(chamado.criado_em)}</span>
      </div>
    </Link>
  );
}
