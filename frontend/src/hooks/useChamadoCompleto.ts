import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Chamado, ChamadoAnexo, ChamadoCompleto, ChamadoHistorico, Usuario } from '@/types/database';

interface UseChamadoCompletoResult {
  chamado: ChamadoCompleto | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
}

/**
 * Busca um chamado por id (ou por número público) junto com seus anexos
 * e histórico, unificando os três SELECTs necessários para montar a
 * tela de detalhe / consulta.
 */
export function useChamadoCompleto(params: {
  id?: string;
  numeroChamado?: string;
}): UseChamadoCompletoResult {
  const { id, numeroChamado } = params;
  const [chamado, setChamado] = useState<ChamadoCompleto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    let query = supabase.from('chamados').select('*');
    query = id ? query.eq('id', id) : query.eq('numero_chamado', numeroChamado ?? '');

    const { data: chamadoData, error: erroChamado } = await query.maybeSingle<Chamado>();

    if (erroChamado) {
      setErro(erroChamado.message);
      setCarregando(false);
      return;
    }

    if (!chamadoData) {
      setErro('Chamado não encontrado.');
      setChamado(null);
      setCarregando(false);
      return;
    }

    const [{ data: anexos }, { data: historico }] = await Promise.all([
      supabase
        .from('chamado_anexos')
        .select('*')
        .eq('chamado_id', chamadoData.id)
        .order('criado_em', { ascending: true })
        .returns<ChamadoAnexo[]>(),
      supabase
        .from('chamado_historico')
        .select('*')
        .eq('chamado_id', chamadoData.id)
        .order('criado_em', { ascending: true })
        .returns<ChamadoHistorico[]>(),
    ]);

    const idsUsuarios = [...new Set((historico ?? []).map((item) => item.usuario_id).filter(Boolean))] as string[];
    const { data: usuarios } = idsUsuarios.length
      ? await supabase.from('usuarios').select('id, nome, papel').in('id', idsUsuarios).returns<Pick<Usuario, 'id' | 'nome' | 'papel'>[]>()
      : { data: [] as Pick<Usuario, 'id' | 'nome' | 'papel'>[] };
    const usuariosPorId = new Map((usuarios ?? []).map((item) => [item.id, item]));

    setChamado({
      ...chamadoData,
      anexos: anexos ?? [],
      historico: (historico ?? []).map((item) => ({
        ...item,
        usuario: item.usuario_id ? usuariosPorId.get(item.usuario_id) ?? null : null,
      })),
    });
    setCarregando(false);
  }, [id, numeroChamado]);

  useEffect(() => {
    if (id || numeroChamado) carregar();
  }, [carregar, id, numeroChamado]);

  return { chamado, carregando, erro, recarregar: carregar };
}
