import { LayoutInterno } from '@/components/LayoutInterno';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

interface CondominioInfo {
  id: string;
  nome: string;
}

const LABEL_PAPEL: Record<string, string> = {
  ADMIN: 'Síndico / Administrador',
  COMPRAS: 'Gestor de Compras',
  ARTIFICE: 'Artífice / Executor',
};

function getTipoAdmin(isMaster: boolean): string {
  return isMaster ? 'Síndico Master' : 'Admin Comum';
}

export function PerfilUsuario() {
  const { usuario } = useAuth();
  const [condominio, setCondominio] = useState<CondominioInfo | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarCondominio() {
      if (!usuario?.condominio_id) {
        setCarregando(false);
        return;
      }

      const { data } = await supabase
        .from('condominios')
        .select('id, nome')
        .eq('id', usuario.condominio_id)
        .single();

      setCondominio(data ?? null);
      setCarregando(false);
    }

    carregarCondominio();
  }, [usuario?.condominio_id]);

  if (!usuario) {
    return (
      <LayoutInterno titulo="Perfil">
        <p className="text-sm text-red-600">Usuário não encontrado.</p>
      </LayoutInterno>
    );
  }

  return (
    <LayoutInterno titulo="Perfil">
      <div className="flex flex-col gap-4">
        <div className="card">
          <p className="text-xs text-ardosia-400 mb-1">Nome</p>
          <p className="text-lg font-semibold text-ardosia-800">{usuario.nome}</p>
        </div>

        <div className="card">
          <p className="text-xs text-ardosia-400 mb-1">E-mail</p>
          <p className="text-sm text-ardosia-700 break-all">{usuario.email}</p>
        </div>

        <div className="card">
          <p className="text-xs text-ardosia-400 mb-1">Papel</p>
          <p className="text-sm font-medium text-ardosia-700">{LABEL_PAPEL[usuario.papel]}</p>
        </div>

        {usuario.papel === 'ADMIN' && (
          <div className="card">
            <p className="text-xs text-ardosia-400 mb-1">Tipo de Administrador</p>
            <p className="text-sm font-medium text-ardosia-700">
              {getTipoAdmin(usuario.admin_master)}
            </p>
          </div>
        )}

        {!carregando && condominio && (
          <div className="card">
            <p className="text-xs text-ardosia-400 mb-1">Condomínio Vinculado</p>
            <p className="text-sm font-medium text-ardosia-700">{condominio.nome}</p>
          </div>
        )}

        {!carregando && !condominio && usuario.condominio_id && (
          <div className="card bg-ardosia-50 border-ardosia-200">
            <p className="text-xs text-ardosia-600">
              Nenhum condomínio encontrado para este usuário.
            </p>
          </div>
        )}
      </div>
    </LayoutInterno>
  );
}
