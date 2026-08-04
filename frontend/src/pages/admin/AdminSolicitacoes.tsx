import { useMemo, useState } from 'react';
import { LayoutInterno } from '@/components/LayoutInterno';
import { CartaoChamado } from '@/components/CartaoChamado';
import { useChamadosPorStatus } from '@/hooks/useChamadosPorStatus';

export function AdminSolicitacoes() {
  const [busca, setBusca] = useState('');
  const { chamados, carregando } = useChamadosPorStatus(['EM_ANALISE']);

  // Filtra por busca (morador_nome ou numero_chamado)
  const chamadosFiltrados = useMemo(() => {
    if (!busca.trim()) return chamados;
    const termoBusca = busca.toLowerCase();
    return chamados.filter(
      (c) =>
        c.morador_nome.toLowerCase().includes(termoBusca) ||
        (c.numero_chamado?.toLowerCase().includes(termoBusca) ?? false)
    );
  }, [chamados, busca]);

  return (
    <LayoutInterno titulo="Solicitações para analisar">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ardosia-500">
          Solicitações enviadas pelos moradores, aguardando sua aprovação para seguirem para
          compras.
        </p>

        <input
          type="text"
          className="input"
          placeholder="Buscar por morador ou nº do chamado..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {carregando && <p className="text-sm text-ardosia-400">Carregando...</p>}

        {!carregando && chamadosFiltrados.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-ardosia-400 text-sm">Nenhuma solicitação pendente. 🎉</p>
          </div>
        )}

        {chamadosFiltrados.map((c) => (
          <CartaoChamado key={c.id} chamado={c} linkPara={`/interno/admin/solicitacoes/${c.id}`} />
        ))}
      </div>
    </LayoutInterno>
  );
}
