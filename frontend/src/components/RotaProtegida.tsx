import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { PapelUsuario } from '@/types/database';

/**
 * Protege rotas internas: exige sessão ativa e (opcionalmente) um papel
 * específico. Redireciona para /login preservando a rota de origem, para
 * voltar a ela automaticamente após o login.
 */
export function RotaProtegida({
  papeisPermitidos,
  children,
}: {
  papeisPermitidos?: PapelUsuario[];
  children: ReactNode;
}) {
  const { sessao, usuario, carregando, erroVinculo, sair } = useAuth();
  const location = useLocation();

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ardosia-50">
        <p className="text-sm text-ardosia-400">Carregando...</p>
      </div>
    );
  }

  if (!sessao) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!usuario) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-ardosia-50 px-6 text-center">
        <p className="text-red-600 font-medium">
          {erroVinculo ?? 'Não foi possível carregar seu perfil.'}
        </p>
        <button className="btn-secundario" onClick={() => sair()}>
          Sair e tentar outra conta
        </button>
      </div>
    );
  }

  if (papeisPermitidos && !papeisPermitidos.includes(usuario.papel)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-ardosia-50 px-6 text-center">
        <p className="text-red-600 font-medium">
          Seu perfil ({usuario.papel}) não tem acesso a esta área.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
