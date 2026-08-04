import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { Usuario } from '@/types/database';

/**
 * Gerencia a sessão de autenticação (Supabase Auth) e carrega o registro
 * correspondente em `usuarios` (nome, papel, condomínio) para o usuário
 * logado. Usado por toda a área interna (Admin/Compras/Artífice).
 *
 * O morador nunca passa por este contexto - as telas públicas não exigem
 * sessão nenhuma.
 */

interface AuthContextValue {
  sessao: Session | null;
  usuario: Usuario | null;
  carregando: boolean;
  /** Preenchido quando existe sessão válida, mas nenhum `usuarios` vinculado
   * (ex: conta desativada pelo admin depois de já ter feito login antes). */
  erroVinculo: string | null;
  entrar: (email: string, senha: string) => Promise<{ erro: string | null }>;
  cadastrarSenha: (email: string, senha: string) => Promise<{ erro: string | null }>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroVinculo, setErroVinculo] = useState<string | null>(null);

  async function carregarUsuarioDaSessao(sessaoAtual: Session | null) {
    if (!sessaoAtual) {
      setUsuario(null);
      setErroVinculo(null);
      return;
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', sessaoAtual.user.id)
      .eq('ativo', true)
      .maybeSingle<Usuario>();

    if (error || !data) {
      setUsuario(null);
      setErroVinculo(
        'Sua conta não está vinculada a nenhum perfil ativo. Fale com o síndico/admin.'
      );
      return;
    }

    setUsuario(data);
    setErroVinculo(null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSessao(data.session);
      await carregarUsuarioDaSessao(data.session);
      setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_evento, novaSessao) => {
      setSessao(novaSessao);
      setCarregando(true);
      await carregarUsuarioDaSessao(novaSessao);
      setCarregando(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) return { erro: traduzirErroAuth(error.message) };
    return { erro: null };
  }

  async function cadastrarSenha(email: string, senha: string) {
    const { error } = await supabase.auth.signUp({ email, password: senha });
    if (error) return { erro: traduzirErroAuth(error.message) };
    return { erro: null };
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  const value: AuthContextValue = {
    sessao,
    usuario,
    carregando,
    erroVinculo,
    entrar,
    cadastrarSenha,
    sair,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}

/** Mensagens mais amigáveis para os erros mais comuns retornados pelo Supabase Auth. */
function traduzirErroAuth(mensagem: string): string {
  if (mensagem.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (mensagem.includes('User already registered')) {
    return 'Já existe uma senha criada para este e-mail. Use a opção "Entrar".';
  }
  if (mensagem.includes('Password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  return mensagem;
}
