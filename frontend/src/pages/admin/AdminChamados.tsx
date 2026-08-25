import { useMemo, useState } from 'react';
import { LayoutInterno } from '@/components/LayoutInterno';
import { CartaoChamado } from '@/components/CartaoChamado';
import { useChamadosPorStatus } from '@/hooks/useChamadosPorStatus';
import { STATUS_META } from '@/utils/statusChamado';
import type { Chamado, StatusChamado } from '@/types/database';

// Todos os status exceto EM_ANALISE (que fica em Solicitações)
const TODOS_STATUS = Object.keys(STATUS_META).filter(
  (s) => s !== 'EM_ANALISE'
) as StatusChamado[];

export function AdminChamados() {
  const [filtro, setFiltro] = useState<StatusChamado[]>([...TODOS_STATUS]);
  const [busca, setBusca] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const { chamados, carregando } = useChamadosPorStatus(filtro);

  // Filtra por busca (morador_nome ou numero_chamado)
  const chamadosFiltrados = useMemo(() => {
    const inicio = dataInicial ? new Date(`${dataInicial}T00:00:00`).getTime() : null;
    const fim = dataFinal ? new Date(`${dataFinal}T23:59:59.999`).getTime() : null;
    const termoBusca = busca.toLowerCase();
    return chamados.filter(
      (c) =>
        (!termoBusca || c.morador_nome.toLowerCase().includes(termoBusca) ||
          (c.numero_chamado?.toLowerCase().includes(termoBusca) ?? false)) &&
        (inicio === null || new Date(c.atualizado_em).getTime() >= inicio) &&
        (fim === null || new Date(c.atualizado_em).getTime() <= fim)
    );
  }, [chamados, busca, dataInicial, dataFinal]);

  function alternarFiltro(status: StatusChamado) {
    setFiltro((atual) => {
      // Se já está selecionado apenas este status, deseleciona (volta para todos)
      if (atual.length === 1 && atual[0] === status) {
        return [...TODOS_STATUS];
      }
      // Caso contrário, seleciona apenas este status
      return [status];
    });
  }

  return (
    <LayoutInterno titulo="Todos os chamados">
      <div className="flex flex-col gap-3">
        <input
          type="text"
          className="input"
          placeholder="Buscar por morador ou nº do chamado..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ardosia-500">
            De
            <input type="date" className="input mt-1" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
          </label>
          <label className="text-xs text-ardosia-500">
            Até
            <input type="date" className="input mt-1" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          <button
            onClick={() => setFiltro([...TODOS_STATUS])}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border ${
              filtro.length === TODOS_STATUS.length
                ? 'bg-ardosia-800 text-white border-ardosia-800'
                : 'bg-white text-ardosia-500 border-ardosia-200'
            }`}
          >
            Todos
          </button>
          {TODOS_STATUS.map((status) => (
            <button
              key={status}
              onClick={() => alternarFiltro(status)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border ${
                filtro.includes(status) && filtro.length !== TODOS_STATUS.length
                  ? 'bg-ambar-500 text-ardosia-950 border-ambar-500'
                  : 'bg-white text-ardosia-500 border-ardosia-200'
              }`}
            >
              {STATUS_META[status].label}
            </button>
          ))}
        </div>

        {carregando && <p className="text-sm text-ardosia-400">Carregando...</p>}

        {!carregando && chamadosFiltrados.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-ardosia-400 text-sm">Nenhum chamado neste filtro.</p>
          </div>
        )}

        {chamadosFiltrados.map((c) => (
          <CartaoChamado key={c.id} chamado={c} linkPara={`/interno/admin/chamados/${c.id}`} />
        ))}
      </div>
    </LayoutInterno>
  );
}
