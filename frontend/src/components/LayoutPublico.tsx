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
    <div className="min-h-screen bg-[#101010] text-white flex flex-col">
      <header className="sticky top-0 z-10 border-b border-[#d7aa36]/25 bg-[#111111]/95 px-4 py-3 shadow-lg backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          {voltarPara && <BackButton to={voltarPara} />}
          <img src="/logo-gabriel-lima.png" alt="Gabriel Lima" className="h-auto w-28 max-w-[30vw] object-contain sm:w-36" />
          <div className="min-w-0 flex-1 border-l border-white/10 pl-3">
            <p className="truncate font-display text-base font-extrabold leading-tight text-[#f7d36d] sm:text-lg">
              Gabriel Lima
            </p>
            <p className="truncate text-xs leading-tight text-white/55">{titulo}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/35">
        Gabriel Lima - Síndico Profissional |{' '}
        <a
          href="https://www.linkedin.com/in/elo-serviços-6aa429428"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#d7aa36] transition-colors hover:text-[#f7d36d]"
        >
          ED Serviços, 2026, v0.1.0
        </a>
      </footer>
    </div>
  );
}
