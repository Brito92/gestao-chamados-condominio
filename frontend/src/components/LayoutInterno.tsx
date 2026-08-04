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
    // Removi o 'pb-20' daqui, pois não temos mais o menu fixo no rodapé ocupando espaço
    <div className="min-h-screen bg-ardosia-50 flex flex-col">
      <header className="bg-ardosia-800 text-white px-4 pt-4 pb-3 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Botão Hambúrguer (Três tracinhos) */}
            {usuario && (
              <button
                onClick={() => setMenuAberto(true)}
                className="p-1 -ml-1 text-white/90 hover:text-white focus:outline-none rounded"
                aria-label="Abrir menu principal"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="font-display font-extrabold text-lg leading-tight truncate">Chamando Condomínio</p>
              <p className="text-xs text-white/70 leading-tight truncate">{titulo}</p>
            </div>
          </div>

          {usuario && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-right min-w-0 hidden sm:block">
                <p className="text-xs font-semibold leading-tight truncate">{usuario.nome}</p>
                <p className="text-[10px] text-white/60 leading-tight">
                  {LABEL_PAPEL[usuario.papel]}
                </p>
              </div>
              <button
                onClick={() => sair()}
                className="bg-ardosia-700 hover:bg-ardosia-600 active:bg-ardosia-500 text-white text-xs font-medium rounded-lg px-3 py-2.5 border border-ardosia-600 transition-colors min-w-[60px]"
                aria-label="Sair"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl w-full mx-auto">{children}</main>

      {/* Overlay escuro que fica atrás do menu quando ele está aberto */}
      {menuAberto && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity backdrop-blur-sm"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* Menu Lateral Deslizante */}
      <nav 
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-ardosia-100 flex items-center justify-between bg-ardosia-50">
          <span className="font-display font-bold text-ardosia-800">Menu</span>
          <button 
            onClick={() => setMenuAberto(false)}
            className="p-2 text-ardosia-400 hover:text-ardosia-700 hover:bg-ardosia-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 flex flex-col">
          {itensNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => setMenuAberto(false)} // Fecha o menu automaticamente ao clicar em um link
              className={({ isActive }) =>
                `flex items-center gap-3 py-3.5 px-5 text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-ambar-50 text-ambar-700 border-r-4 border-ambar-600' 
                    : 'text-ardosia-600 hover:bg-ardosia-50 hover:text-ardosia-900'
                }`
              }
            >
              <span className="text-xl w-6 text-center">{item.icone}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
        
        {/* Mostra os dados do usuário no rodapé do menu em telas menores */}
        {usuario && (
          <div className="p-4 border-t border-ardosia-100 bg-ardosia-50 sm:hidden">
            <p className="text-sm font-semibold text-ardosia-800 truncate">{usuario.nome}</p>
            <p className="text-xs text-ardosia-500 truncate">{LABEL_PAPEL[usuario.papel]}</p>
          </div>
        )}
      </nav>
    </div>
  );
}