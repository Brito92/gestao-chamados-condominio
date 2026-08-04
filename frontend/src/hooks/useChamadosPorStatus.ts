import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Chamado, StatusChamado } from '@/types/database';

/**
 * Lista chamados filtrados por um ou mais status, ordenados do mais
 * recente para o mais antigo (mais recente primeiro).
 */
export function useChamadosPorStatus(status: StatusChamado[]) {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(true);

  const chave = status.join(',');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase
      .from('chamados')
      .select('*')
      .in('status', status)
      .order('criado_em', { ascending: false })
      .returns<Chamado[]>();
    setChamados(data ?? []);
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { chamados, carregando, recarregar: carregar };
}
