import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Chamado, ChamadoAnexo, ChamadoCompleto, ChamadoHistorico, Usuario } from '@/types/database';

interface ChamadoPublicoRpc {
  chamado: Chamado;
  anexos: ChamadoAnexo[] | null;
  historico: ChamadoHistorico[] | null;
}

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
  contatoPublico?: string;
}): UseChamadoCompletoResult {
  const { id, numeroChamado, contatoPublico } = params;
  const [chamado, setChamado] = useState<ChamadoCompleto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    if (!id && numeroChamado) {
      const { data, error } = await supabase
        .rpc('consultar_chamado_publico', {
          p_numero_chamado: numeroChamado,
          p_contato: contatoPublico ?? '',
        })
        .maybeSingle<ChamadoPublicoRpc>();

      if (error) {
        setErro(error.message);
        setCarregando(false);
        return;
      }

      if (!data) {
        setErro('Chamado não encontrado.');
        setChamado(null);
        setCarregando(false);
        return;
      }

      setChamado({
        ...data.chamado,
        anexos: data.anexos ?? [],
        historico: (data.historico ?? []).map((item) => ({
          ...item,
          usuario: null,
        })),
      });
      setCarregando(false);
      return;
    }

    let query = supabase.from('chamados').select('*');
    query = query.eq('id', id ?? '');

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

    const idsUsuarios = [...new Set([
      ...(historico ?? []).map((item) => item.usuario_id),
      chamadoData.artifice_id,
    ].filter(Boolean))] as string[];
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
      artifice: chamadoData.artifice_id ? usuariosPorId.get(chamadoData.artifice_id) ?? null : null,
    });
    setCarregando(false);
  }, [id, numeroChamado, contatoPublico]);

  useEffect(() => {
    if (id || numeroChamado) carregar();
  }, [carregar, id, numeroChamado]);

  return { chamado, carregando, erro, recarregar: carregar };
}
