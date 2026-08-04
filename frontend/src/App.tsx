import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { RotaProtegida } from '@/components/RotaProtegida';

import { Home } from '@/pages/publico/Home';
import { AbrirChamado } from '@/pages/publico/AbrirChamado';
import { SucessoAbertura } from '@/pages/publico/SucessoAbertura';
import { ConsultarChamado } from '@/pages/publico/ConsultarChamado';
import { Login } from '@/pages/auth/Login';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminSolicitacoes } from '@/pages/admin/AdminSolicitacoes';
import { AdminSolicitacaoDetalhe } from '@/pages/admin/AdminSolicitacaoDetalhe';
import { AdminChamados } from '@/pages/admin/AdminChamados';
import { AdminChamadoDetalhe } from '@/pages/admin/AdminChamadoDetalhe';
import { AdminUsuarios } from '@/pages/admin/AdminUsuarios';
import { AdminCondominios } from '@/pages/admin/AdminCondominios';

import { ComprasFila } from '@/pages/compras/ComprasFila';
import { ComprasChamadoDetalhe } from '@/pages/compras/ComprasChamadoDetalhe';

import { ArtificeFila } from '@/pages/artifice/ArtificeFila';
import { ArtificeChamadoDetalhe } from '@/pages/artifice/ArtificeChamadoDetalhe';
import { ArtificeHistorico } from '@/pages/artifice/ArtificeHistorico';

import { PerfilUsuario } from '@/pages/PerfilUsuario';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Área pública - morador, sem login */}
        <Route path="/" element={<Home />} />
        <Route path="/abrir-chamado" element={<AbrirChamado />} />
        <Route path="/abrir-chamado/sucesso" element={<SucessoAbertura />} />
        <Route path="/consultar" element={<ConsultarChamado />} />
        <Route path="/login" element={<Login />} />

        {/* Área interna - admin/síndico */}
        <Route
          path="/interno/admin"
          element={
            <RotaProtegida papeisPermitidos={['ADMIN']}>
              <AdminDashboard />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/admin/solicitacoes"
          element={
            <RotaProtegida papeisPermitidos={['ADMIN']}>
              <AdminSolicitacoes />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/admin/solicitacoes/:id"
          element={
            <RotaProtegida papeisPermitidos={['ADMIN']}>
              <AdminSolicitacaoDetalhe />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/admin/chamados"
          element={
            <RotaProtegida papeisPermitidos={['ADMIN']}>
              <AdminChamados />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/admin/chamados/:id"
          element={
            <RotaProtegida papeisPermitidos={['ADMIN']}>
              <AdminChamadoDetalhe />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/admin/usuarios"
          element={
            <RotaProtegida papeisPermitidos={['ADMIN']}>
              <AdminUsuarios />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/admin/condominios"
          element={
            <RotaProtegida papeisPermitidos={['ADMIN']}>
              <AdminCondominios />
            </RotaProtegida>
          }
        />

        {/* Área interna - compras: só enxerga o que o admin já aprovou */}
        <Route
          path="/interno/compras"
          element={
            <RotaProtegida papeisPermitidos={['COMPRAS']}>
              <ComprasFila />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/compras/:id"
          element={
            <RotaProtegida papeisPermitidos={['COMPRAS']}>
              <ComprasChamadoDetalhe />
            </RotaProtegida>
          }
        />

        {/* Área interna - artífice: só enxerga o que compras já liberou */}
        <Route
          path="/interno/artifice"
          element={
            <RotaProtegida papeisPermitidos={['ARTIFICE']}>
              <ArtificeFila />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/artifice/:id"
          element={
            <RotaProtegida papeisPermitidos={['ARTIFICE']}>
              <ArtificeChamadoDetalhe />
            </RotaProtegida>
          }
        />
        <Route
          path="/interno/artifice/historico"
          element={
            <RotaProtegida papeisPermitidos={['ARTIFICE']}>
              <ArtificeHistorico />
            </RotaProtegida>
          }
        />

        {/* Perfil do usuário - compartilhado entre os 3 papéis */}
        <Route
          path="/interno/perfil"
          element={
            <RotaProtegida papeisPermitidos={['ADMIN', 'COMPRAS', 'ARTIFICE']}>
              <PerfilUsuario />
            </RotaProtegida>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
