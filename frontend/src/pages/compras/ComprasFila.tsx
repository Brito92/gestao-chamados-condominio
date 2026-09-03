import { LayoutInterno } from '@/components/LayoutInterno';
import { CartaoChamado } from '@/components/CartaoChamado';
import { useChamadosPorStatus } from '@/hooks/useChamadosPorStatus';

export function ComprasFila() {
  const { chamados, carregando } = useChamadosPorStatus(['ENVIADO_PARA_COMPRAS', 'EM_COMPRAS']);

  return (
    <LayoutInterno titulo="Fila de compras">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ardosia-500">
          Chamados aprovados pelo síndico, aguardando avaliação de necessidade de compra de
          materiais.
        </p>

        {carregando && <p className="text-sm text-ardosia-400">Carregando...</p>}

        {!carregando && chamados.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-ardosia-400 text-sm">Nenhum chamado na fila de compras. 🎉</p>
          </div>
        )}

        {chamados.map((c) => (
          <CartaoChamado key={c.id} chamado={c} linkPara={`/interno/compras/${c.id}`} />
        ))}
      </div>
    </LayoutInterno>
  );
}
