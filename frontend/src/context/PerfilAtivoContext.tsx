import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { PapelUsuario, Usuario } from '@/types/database';

/**
 * Este MVP foi construído explicitamente sem tela de login, para permitir
 * navegar livremente por todas as visões do sistema. Este contexto
 * simula "estar logado como" um usuário interno (admin/compras/artífice),
 * guardando a seleção no localStorage do navegador.
 *
 * Quando o login real (Supabase Auth) for implementado, este contexto pode
 * ser substituído por um que leia a sessão de `supabase.auth` e busque o
 * usuário correspondente via `auth_user_id` - sem precisar alterar as
 * telas que consomem `usePerfilAtivo()`.
 */

const CHAVE_STORAGE = 'zelo:perfilAtivoId';

interface PerfilAtivoContextValue {
  usuario: Usuario | null;
  usuariosDisponiveis: Usuario[];
  carregando: boolean;
  selecionarUsuario: (usuarioId: string) => void;
  papelAtivo: PapelUsuario | null;
}

const PerfilAtivoContext = createContext<PerfilAtivoContextValue | undefined>(undefined);

export function PerfilAtivoProvider({ children }: { children: ReactNode }) {
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<Usuario[]>([]);
  const [usuarioId, setUsuarioId] = useState<string | null>(
    () => localStorage.getItem(CHAVE_STORAGE)
  );
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarUsuarios() {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('ativo', true)
        .order('papel', { ascending: true })
        .order('nome', { ascending: true });

      if (!error && data) {
        setUsuariosDisponiveis(data as Usuario[]);
        // Se nada selecionado ainda, cai por padrão no primeiro admin encontrado.
        if (!usuarioId && data.length > 0) {
          const admin = data.find((u) => u.papel === 'ADMIN');
          setUsuarioId((admin ?? data[0]).id);
        }
      }
      setCarregando(false);
    }
    carregarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (usuarioId) localStorage.setItem(CHAVE_STORAGE, usuarioId);
  }, [usuarioId]);

  const usuario = useMemo(
    () => usuariosDisponiveis.find((u) => u.id === usuarioId) ?? null,
    [usuariosDisponiveis, usuarioId]
  );

  const value: PerfilAtivoContextValue = {
    usuario,
    usuariosDisponiveis,
    carregando,
    selecionarUsuario: setUsuarioId,
    papelAtivo: usuario?.papel ?? null,
  };

  return <PerfilAtivoContext.Provider value={value}>{children}</PerfilAtivoContext.Provider>;
}

export function usePerfilAtivo(): PerfilAtivoContextValue {
  const ctx = useContext(PerfilAtivoContext);
  if (!ctx) throw new Error('usePerfilAtivo deve ser usado dentro de <PerfilAtivoProvider>');
  return ctx;
}
