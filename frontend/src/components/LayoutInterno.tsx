import { NavLink } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { PapelUsuario } from '@/types/database';

interface ItemNav {
  to: string;
  label: string;
  icone: string;
}

const NAV_POR_PAPEL: Record<PapelUsuario, ItemNav[]> = {
  ADMIN: [
    { to: '/interno/admin', label: 'Painel', icone: '📊' },
    { to: '/interno/admin/solicitacoes', label: 'Solicitações', icone: '📥' },
    { to: '/interno/admin/chamados', label: 'Chamados', icone: '🛠️' },
    { to: '/interno/admin/usuarios', label: 'Equipe', icone: '👥' },
    { to: '/interno/admin/condominios', label: 'Condomínios', icone: '🏢' },
    { to: '/interno/perfil', label: 'Perfil', icone: '👤' },
  ],
  COMPRAS: [
    { to: '/interno/compras', label: 'Fila de compras', icone: '🧾' },
    { to: '/interno/perfil', label: 'Perfil', icone: '👤' },
  ],
  ARTIFICE: [
    { to: '/interno/artifice', label: 'Minhas execuções', icone: '🔧' },
    { to: '/interno/artifice/historico', label: 'Histórico', icone: '📜' },
    { to: '/interno/perfil', label: 'Perfil', icone: '👤' },
  ],
};

const LABEL_PAPEL: Record<PapelUsuario, string> = {
  ADMIN: 'Síndico / Admin',
  COMPRAS: 'Compras',
  ARTIFICE: 'Artífice',
};

export function LayoutInterno({ children, titulo }: { children: ReactNode; titulo: string }) {
  const { usuario, sair } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const itensNav = usuario ? NAV_POR_PAPEL[usuario.papel] : [];

  return (
    <div className="min-h-screen bg-[#101010] text-white flex flex-col">
      <header className="sticky top-0 z-20 border-b border-[#d7aa36]/25 bg-[#111111]/95 px-4 pb-3 pt-4 shadow-[0_8px_30px_rgba(0,0,0,.2)] backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {usuario && (
              <button
                type="button"
                onClick={() => setMenuAberto(true)}
                className="-ml-1 rounded-lg p-1 text-[#e8bd54] hover:bg-[#e8bd54]/10 focus:outline-none"
                aria-label="Abrir menu principal"
              >
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-extrabold leading-tight text-[#f7d36d]">
                Gabriel Lima
              </p>
              <p className="truncate text-xs leading-tight text-white/55">{titulo}</p>
            </div>
          </div>

          {usuario && (
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-xs font-semibold leading-tight text-white">{usuario.nome}</p>
                <p className="text-[10px] leading-tight text-[#e8bd54]">{LABEL_PAPEL[usuario.papel]}</p>
              </div>
              <button
                type="button"
                onClick={() => sair()}
                className="min-w-[60px] rounded-lg border border-white/10 bg-[#202020] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:border-[#e8bd54]/40 hover:text-[#f7d36d]"
                aria-label="Sair"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>

      {menuAberto && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" onClick={() => setMenuAberto(false)} />
      )}

      <nav
        className={`fixed left-0 top-0 z-50 flex h-full w-[min(82vw,320px)] transform flex-col border-r border-[#d7aa36]/25 bg-[#171717] shadow-2xl transition-transform duration-300 ease-in-out ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/10 bg-[#111111] p-5">
          <div className="flex items-center justify-between gap-3">
            <img src="/logo-gabriel-lima.png" alt="Gabriel Lima" className="h-auto w-40 max-w-[65%] object-contain" />
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-[#f7d36d]"
              aria-label="Fechar menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#d7aa36]">Área da equipe</p>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto py-3">
          {itensNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => setMenuAberto(false)}
              className={({ isActive }) =>
                `mx-2 flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'border border-[#d7aa36]/30 bg-[#3b3018] text-[#f7d36d]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span className="w-6 text-center text-xl">{item.icone}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {usuario && (
          <div className="border-t border-white/10 bg-[#111111] p-4 sm:hidden">
            <p className="truncate text-sm font-semibold text-white">{usuario.nome}</p>
            <p className="truncate text-xs text-[#e8bd54]">{LABEL_PAPEL[usuario.papel]}</p>
          </div>
        )}
      </nav>
    </div>
  );
}
