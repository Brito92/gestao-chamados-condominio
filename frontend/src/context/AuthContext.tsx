import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { Usuario } from '@/types/database';
import { validarOrigemDaAcao } from '@/utils/csrf';

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
  const sessaoAtualRef = useRef<Session | null>(null);

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

  const validarSessaoAtiva = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Não foi possível validar a sessão neste momento:', error.message);
      return Boolean(sessaoAtualRef.current);
    }

    if (!data.session) {
      setSessao(null);
      sessaoAtualRef.current = null;
      setUsuario(null);
      setErroVinculo(null);
      return false;
    }

    const { data: usuarioRemoto, error: erroSessao } = await supabase.auth.getUser();
    if (erroSessao) {
      if (erroSessao.status === 401) {
        setSessao(null);
        setUsuario(null);
        setErroVinculo('Sua sessão expirou. Faça login novamente.');
        await supabase.auth.signOut();
        return false;
      }
      console.warn('Não foi possível validar o token neste momento:', erroSessao.message);
      return Boolean(sessaoAtualRef.current);
    }

    if (!usuarioRemoto.user) {
      setSessao(null);
      sessaoAtualRef.current = null;
      setUsuario(null);
      setErroVinculo('Sua sessão não pôde ser confirmada. Faça login novamente.');
      await supabase.auth.signOut();
      return false;
    }

    const { data: usuarioAtivo, error: erroUsuario } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', usuarioRemoto.user.id)
      .eq('ativo', true)
      .maybeSingle<Usuario>();

    if (erroUsuario) {
      console.warn('Não foi possível consultar o perfil da sessão:', erroUsuario.message);
      return Boolean(sessaoAtualRef.current);
    }

    if (!usuarioAtivo) {
      setSessao(data.session);
      setUsuario(null);
      setErroVinculo('Sua conta foi desativada ou não está vinculada a um perfil ativo.');
      await supabase.auth.signOut();
      return false;
    }

    setSessao(data.session);
    sessaoAtualRef.current = data.session;
    setUsuario(usuarioAtivo);
    setErroVinculo(null);
    return true;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSessao(data.session);
      sessaoAtualRef.current = data.session;
      await carregarUsuarioDaSessao(data.session);
      setCarregando(false);
    });

    const validarAoRetornar = () => {
      if (document.visibilityState === 'visible') void validarSessaoAtiva();
    };
    const intervalo = window.setInterval(() => void validarSessaoAtiva(), 5 * 60 * 1000);
    document.addEventListener('visibilitychange', validarAoRetornar);

    const { data: listener } = supabase.auth.onAuthStateChange(async (evento, novaSessao) => {
      const mesmaSessao = Boolean(
        sessaoAtualRef.current?.user.id &&
        novaSessao?.user.id &&
        sessaoAtualRef.current.user.id === novaSessao.user.id,
      );
      setSessao(novaSessao);
      sessaoAtualRef.current = novaSessao;

      // Ao voltar para uma aba/app em segundo plano, o Supabase pode renovar
      // o token. Isso não muda o usuário e não pode desmontar os formulários,
      // pois faria o rascunho visual desaparecer.
      if (evento !== 'SIGNED_OUT' && mesmaSessao) return;

      setCarregando(true);
      await carregarUsuarioDaSessao(novaSessao);
      setCarregando(false);
    });

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', validarAoRetornar);
      listener.subscription.unsubscribe();
    };
  }, [validarSessaoAtiva]);

  async function entrar(email: string, senha: string) {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) return { erro: erroOrigem };
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) return { erro: traduzirErroAuth(error.message) };
    await supabase.rpc('registrar_evento_auditoria', {
      p_acao: 'LOGIN',
      p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    });
    return { erro: null };
  }

  async function cadastrarSenha(email: string, senha: string) {
    const erroOrigem = validarOrigemDaAcao();
    if (erroOrigem) return { erro: erroOrigem };
    const { error } = await supabase.auth.signUp({ email, password: senha });
    if (error) return { erro: traduzirErroAuth(error.message) };
    return { erro: null };
  }

  async function sair() {
    await supabase.rpc('registrar_evento_auditoria', {
      p_acao: 'LOGOUT',
      p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    });
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
