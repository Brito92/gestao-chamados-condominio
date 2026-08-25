import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { PapelUsuario } from '@/types/database';

type Modo = 'entrar' | 'primeiro_acesso';

export function Login() {
  const { sessao, usuario, entrar, cadastrarSenha } = useAuth();

  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoPrimeiroAcesso, setAvisoPrimeiroAcesso] = useState<string | null>(null);

  if (sessao && usuario) {
    return <Navigate to={rotaPadraoPorPapel(usuario.papel)} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAvisoPrimeiroAcesso(null);

    if (!email.trim() || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }

    if (modo === 'primeiro_acesso' && senha !== confirmarSenha) {
      setErro('As senhas não conferem.');
      return;
    }

    setEnviando(true);
    try {
      if (modo === 'entrar') {
        const { erro: erroEntrar } = await entrar(email.trim(), senha);
        if (erroEntrar) setErro(erroEntrar);
      } else {
        const { erro: erroCadastro } = await cadastrarSenha(email.trim(), senha);
        if (erroCadastro) {
          setErro(erroCadastro);
        } else {
          setAvisoPrimeiroAcesso(
            'Senha criada! Se o projeto exigir confirmação por e-mail, verifique sua caixa de entrada antes de entrar.',
          );
          setModo('entrar');
        }
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#101010] text-white flex flex-col lg:flex-row">
      <section className="relative overflow-hidden bg-[#101010] px-6 py-8 sm:px-10 lg:flex lg:min-h-screen lg:w-[46%] lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full border border-[#d7aa36]/20" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full border border-[#d7aa36]/20" />

        <div className="relative mx-auto flex max-w-md flex-col items-center text-center lg:items-start lg:text-left">
          <img
            src="/logo-gabriel-lima.png"
            alt="Gabriel Lima — Síndico Profissional"
            className="h-auto w-full max-w-[360px] object-contain drop-shadow-[0_0_30px_rgba(231,183,61,0.16)] sm:max-w-[420px] lg:max-w-[460px]"
          />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.35em] text-[#e8bd54]">
            Gestão condominial
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[#f7d36d] sm:text-4xl">
            Cuidado que organiza.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
            Acompanhe solicitações, compras e serviços do seu condomínio em um só lugar.
          </p>
        </div>
      </section>

      <main className="flex flex-1 items-center justify-center bg-[#171717] px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#e8bd54] transition-colors hover:text-[#ffe49a]"
          >
            <span aria-hidden="true">←</span> Voltar ao início
          </Link>

          <div className="rounded-3xl border border-[#d7aa36]/25 bg-[#202020] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.35)] sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d7aa36]">
                Área restrita
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">Acesso da equipe</h2>
              <p className="mt-2 text-sm text-white/55">
                Entre para acompanhar e administrar os chamados.
              </p>
            </div>

            <div className="mb-6 flex rounded-2xl border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  modo === 'entrar'
                    ? 'bg-[#e8bd54] text-[#171717] shadow-lg shadow-[#d7aa36]/10'
                    : 'text-white/55 hover:text-white'
                }`}
                onClick={() => {
                  setModo('entrar');
                  setErro(null);
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  modo === 'primeiro_acesso'
                    ? 'bg-[#e8bd54] text-[#171717] shadow-lg shadow-[#d7aa36]/10'
                    : 'text-white/55 hover:text-white'
                }`}
                onClick={() => {
                  setModo('primeiro_acesso');
                  setErro(null);
                }}
              >
                Primeiro acesso
              </button>
            </div>

            {modo === 'primeiro_acesso' && (
              <p className="mb-5 rounded-xl border border-[#d7aa36]/20 bg-[#d7aa36]/10 p-3 text-sm leading-5 text-[#f5d982]">
                Use o mesmo e-mail cadastrado pelo administrador e escolha uma senha.
              </p>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/75">E-mail</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3.5 text-sm text-white placeholder:text-white/25 focus:border-[#e8bd54] focus:outline-none focus:ring-2 focus:ring-[#e8bd54]/25"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@condominio.dev"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-white/75">Senha</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3.5 text-sm text-white placeholder:text-white/25 focus:border-[#e8bd54] focus:outline-none focus:ring-2 focus:ring-[#e8bd54]/25"
                  type="password"
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                />
              </label>

              {modo === 'primeiro_acesso' && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-white/75">
                    Confirmar senha
                  </span>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3.5 text-sm text-white placeholder:text-white/25 focus:border-[#e8bd54] focus:outline-none focus:ring-2 focus:ring-[#e8bd54]/25"
                    type="password"
                    autoComplete="new-password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                  />
                </label>
              )}

              {erro && (
                <p className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">
                  {erro}
                </p>
              )}
              {avisoPrimeiroAcesso && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/40 p-3 text-sm text-emerald-200">
                  {avisoPrimeiroAcesso}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="mt-1 rounded-xl bg-[#e8bd54] px-4 py-3.5 text-center font-bold text-[#171717] shadow-lg shadow-[#d7aa36]/10 transition hover:bg-[#f4d477] active:scale-[0.98] disabled:opacity-60"
              >
                {enviando
                  ? 'Processando...'
                  : modo === 'entrar'
                    ? 'Entrar'
                    : 'Criar senha e continuar'}
              </button>
            </form>

            <Link to="/" className="mt-6 block text-center text-xs text-white/40 transition hover:text-white/70">
              Sou morador, voltar ao início
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-white/30">
            Gabriel Lima · Síndico Profissional
          </p>
        </div>
      </main>
    </div>
  );
}

function rotaPadraoPorPapel(papel: PapelUsuario): string {
  switch (papel) {
    case 'ADMIN':
      return '/interno/admin';
    case 'COMPRAS':
      return '/interno/compras';
    case 'ARTIFICE':
      return '/interno/artifice';
    default:
      return '/';
  }
}
