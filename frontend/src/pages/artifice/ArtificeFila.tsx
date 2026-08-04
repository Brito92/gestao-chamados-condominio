import { LayoutInterno } from '@/components/LayoutInterno';
import { CartaoChamado } from '@/components/CartaoChamado';
import { useChamadosPorStatus } from '@/hooks/useChamadosPorStatus';
import { useAuth } from '@/context/AuthContext';

export function ArtificeFila() {
  const { usuario } = useAuth();
  const { chamados, carregando } = useChamadosPorStatus(['AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO']);

  // Mostra chamados ainda sem artífice definido (disponíveis para pegar) e
  // os que já estão atribuídos a mim.
  const disponiveis = chamados.filter(
    (c) => c.status === 'AGUARDANDO_EXECUCAO' && !c.artifice_id
  );
  const meus = chamados.filter((c) => c.artifice_id === usuario?.id);

  return (
    <LayoutInterno titulo="Execuções">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold text-ardosia-700 mb-2">Minhas execuções</h2>
          {carregando && <p className="text-sm text-ardosia-400">Carregando...</p>}
          {!carregando && meus.length === 0 && (
            <p className="text-sm text-ardosia-400">Nenhum chamado atribuído a você ainda.</p>
          )}
          <div className="flex flex-col gap-2">
            {meus.map((c) => (
              <CartaoChamado key={c.id} chamado={c} linkPara={`/interno/artifice/${c.id}`} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-ardosia-700 mb-2">
            Disponíveis para atender
          </h2>
          {!carregando && disponiveis.length === 0 && (
            <p className="text-sm text-ardosia-400">Nenhum chamado disponível no momento.</p>
          )}
          <div className="flex flex-col gap-2">
            {disponiveis.map((c) => (
              <CartaoChamado key={c.id} chamado={c} linkPara={`/interno/artifice/${c.id}`} />
            ))}
          </div>
        </div>
      </div>
    </LayoutInterno>
  );
}
