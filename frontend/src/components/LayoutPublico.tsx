import type { ReactNode } from 'react';
import { BackButton } from './BackButton';

export function LayoutPublico({
  children,
  titulo,
  voltarPara,
}: {
  children: ReactNode;
  titulo: string;
  voltarPara?: string;
}) {
  return (
    <div className="min-h-screen bg-ardosia-50 flex flex-col">
      <header className="bg-ardosia-800 text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-lg">
        {voltarPara && <BackButton to={voltarPara} />}
        <div className="flex-1 min-w-0">
          <p className="font-display font-extrabold text-lg leading-tight truncate">Chamando Condomínio</p>
          <p className="text-xs text-white/70 leading-tight truncate">{titulo}</p>
        </div>
      </header>
      <main className="flex-1 px-4 py-6 max-w-lg w-full mx-auto">{children}</main>
      <footer className="text-center text-xs text-ardosia-400 py-4">
        Gestão de manutenção do condomínio
      </footer>
    </div>
  );
}
