import { LayoutInterno } from '@/components/LayoutInterno';
import { CartaoChamado } from '@/components/CartaoChamado';
import { useChamadosPorStatus } from '@/hooks/useChamadosPorStatus';
import { useAuth } from '@/context/AuthContext';

export function ArtificeFila() {
  const { usuario } = useAuth();
  const { chamados, carregando } = useChamadosPorStatus(['ENVIADO_PARA_EXECUCAO', 'AGUARDANDO_EXECUCAO', 'EM_ANDAMENTO', 'PENDENTE']);

  // Mostra chamados ainda sem artífice definido (disponíveis para pegar) e
  // os que já estão atribuídos a mim.
  const disponiveis = chamados.filter((c) => {
    const lockAtivo =
      c.assumido_por !== null &&
      (!c.bloqueio_expira_em || new Date(c.bloqueio_expira_em).getTime() > Date.now());
    return c.status === 'ENVIADO_PARA_EXECUCAO' && c.artifice_id === null && !lockAtivo;
  });
  const meus = chamados.filter(
    (c) => c.artifice_id === usuario?.id || c.assumido_por === usuario?.id
  );

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
