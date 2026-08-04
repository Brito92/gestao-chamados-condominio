import { useEffect, useState } from 'react';
import { LayoutInterno } from '@/components/LayoutInterno';
import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { Chamado } from '@/types/database';

export function ArtificeHistorico() {
  const { usuario } = useAuth();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarHistorico();
  }, [usuario?.id]);

  async function carregarHistorico() {
    if (!usuario) return;
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from('chamados')
        .select('*')
        .eq('artifice_id', usuario.id)
        .eq('status', 'FINALIZADO')
        .order('finalizado_em', { ascending: false, nullsFirst: false })
        .returns<Chamado[]>();

      if (error) throw error;
      setChamados(data ?? []);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar histórico');
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  function formatarData(dataIso: string | null) {
    if (!dataIso) return '—';
    try {
      const data = new Date(dataIso);
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  if (carregando) {
    return (
      <LayoutInterno titulo="Histórico">
        <p className="text-sm text-ardosia-400">Carregando...</p>
      </LayoutInterno>
    );
  }

  return (
    <LayoutInterno titulo="Histórico de execuções">
      <div className="flex flex-col gap-4">
        <BackButton />

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {chamados.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-ardosia-400 text-sm">
              Nenhum chamado concluído ainda.
            </p>
          </div>
        )}

        {chamados.map((chamado) => (
          <div key={chamado.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold text-ardosia-800">
                  {chamado.numero_chamado ? `Chamado #${chamado.numero_chamado}` : 'Sem número'}
                </p>
                <p className="text-sm text-ardosia-600">{chamado.morador_nome}</p>
                <p className="text-xs text-ardosia-400">{chamado.local_problema}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-ardosia-500">
                {formatarData(chamado.finalizado_em)}
              </p>

              {chamado.executado ? (
                <span className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">
                  Executado ✓
                </span>
              ) : (
                <span className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700">
                  Não executado
                </span>
              )}
            </div>

            {!chamado.executado && chamado.motivo_nao_execucao && (
              <p className="text-xs text-red-600 italic">
                Motivo: {chamado.motivo_nao_execucao}
              </p>
            )}
          </div>
        ))}
      </div>
    </LayoutInterno>
  );
}
