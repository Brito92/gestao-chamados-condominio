import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LayoutPublico } from '@/components/LayoutPublico';
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

  // Já logado e com perfil válido: manda direto para a área correspondente.
  if (sessao && usuario) {
    const destino = rotaPadraoPorPapel(usuario.papel);
    return <Navigate to={destino} replace />;
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
            'Senha criada! Se o seu projeto exigir confirmação por e-mail, verifique sua caixa de entrada antes de entrar.'
          );
          setModo('entrar');
        }
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutPublico titulo="Acesso da equipe interna" voltarPara="/">
      <div className="flex flex-col gap-5">
        <div className="flex rounded-xl bg-ardosia-100 p-1">
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              modo === 'entrar' ? 'bg-white shadow-card text-ardosia-800' : 'text-ardosia-500'
            }`}
            onClick={() => {
              setModo('entrar');
              setErro(null);
            }}
          >
            Entrar
          </button>
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              modo === 'primeiro_acesso'
                ? 'bg-white shadow-card text-ardosia-800'
                : 'text-ardosia-500'
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
          <p className="text-sm text-ardosia-500">
            Use o mesmo e-mail que o síndico cadastrou para você e escolha uma senha. Só
            e-mails já cadastrados pelo admin conseguem criar acesso.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-ardosia-700 mb-1.5">E-mail</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@condominio.dev"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-ardosia-700 mb-1.5">Senha</span>
            <input
              className="input"
              type="password"
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {modo === 'primeiro_acesso' && (
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
                Confirmar senha
              </span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {erro}
            </p>
          )}
          {avisoPrimeiroAcesso && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              {avisoPrimeiroAcesso}
            </p>
          )}

          <button type="submit" disabled={enviando} className="btn-primario">
            {enviando
              ? 'Processando...'
              : modo === 'entrar'
                ? 'Entrar'
                : 'Criar senha e continuar'}
          </button>
        </form>

        <Link to="/" className="text-center text-xs text-ardosia-400">
          Sou morador, voltar ao início
        </Link>
      </div>
    </LayoutPublico>
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
