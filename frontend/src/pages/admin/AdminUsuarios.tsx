import { useEffect, useState, type FormEvent } from 'react';
import { LayoutInterno } from '@/components/LayoutInterno';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { PapelUsuario, Usuario } from '@/types/database';

const LABEL_PAPEL: Record<PapelUsuario, string> = {
  ADMIN: 'Síndico / Admin',
  COMPRAS: 'Compras',
  ARTIFICE: 'Artífice',
};

export function AdminUsuarios() {
  const { usuario: usuarioLogado } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(
    () => localStorage.getItem('rascunho:admin:usuario:form-aberto') === 'true',
  );
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [condominios, setCondominios] = useState<{id: string; nome: string}[]>([]);

  const [nome, setNome, limparNome] = usePersistedState('rascunho:admin:usuario:nome', '');
  const [email, setEmail, limparEmail] = usePersistedState('rascunho:admin:usuario:email', '');
  const [papel, setPapel, limparPapel] = usePersistedState<PapelUsuario>('rascunho:admin:usuario:papel', 'ARTIFICE');
  const [condominioId, setCondominioId, limparCondominio] = usePersistedState<string>('rascunho:admin:usuario:condominio', '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Verifica se o usuário logado é admin master
  const isAdminMaster = usuarioLogado?.papel === 'ADMIN' && usuarioLogado?.admin_master === true;

  async function carregar() {
    setCarregando(true);
    const [usuariosData, condominiosData] = await Promise.all([
      supabase
        .from('usuarios')
        .select('*')
        .order('papel', { ascending: true })
        .order('nome', { ascending: true })
        .returns<Usuario[]>(),
      supabase
        .from('condominios')
        .select('id, nome')
        .eq('ativo', true)
    ]);
    setUsuarios(usuariosData.data ?? []);
    setCondominios(condominiosData.data ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    localStorage.setItem('rascunho:admin:usuario:form-aberto', String(mostrarForm));
  }, [mostrarForm]);

  function iniciarEdicao(u: Usuario) {
    // Admin comum não pode editar admin master
    if (u.papel === 'ADMIN' && u.id !== usuarioLogado?.id && !isAdminMaster) {
      setErro('Admin comum não pode editar dados de outros administradores.');
      return;
    }
    
    setEditando(u);
    setNome(u.nome);
    setEmail(u.email);
    setPapel(u.papel);
    setCondominioId(u.condominio_id || '');
    setMostrarForm(true);
  }

  function cancelarEdicao() {
    setEditando(null);
    setNome('');
    setEmail('');
    setPapel('ARTIFICE');
    setCondominioId('');
    limparNome();
    limparEmail();
    limparPapel();
    limparCondominio();
    setMostrarForm(false);
    setErro(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !email.trim()) {
      setErro('Nome e e-mail são obrigatórios.');
      return;
    }

    // Admin comum não pode criar outros admins
    if (papel === 'ADMIN' && !isAdminMaster && !editando) {
      setErro('Somente o admin master pode criar novos administradores.');
      return;
    }

    // Admin comum não pode mudar papel para ADMIN
    if (editando && editando.papel !== 'ADMIN' && papel === 'ADMIN' && !isAdminMaster) {
      setErro('Somente o admin master pode promover usuários a administrador.');
      return;
    }

    setSalvando(true);
    try {
      const userData = {
        nome: nome.trim(),
        email: email.trim(),
        papel,
        condominio_id: condominioId || null,
      };

      if (editando) {
        const { error } = await supabase
          .from('usuarios')
          .update(userData)
          .eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('usuarios').insert({
          ...userData,
          criado_por: usuarioLogado?.id ?? null,
          ...(papel === 'ADMIN' ? { admin_master: false } : {}),
        });
        if (error) throw error;
      }

      cancelarEdicao();
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : editando ? 'Não foi possível atualizar o usuário.' : 'Não foi possível criar o usuário.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(u: Usuario) {
    // Admin comum não pode desativar outros admins
    if (u.papel === 'ADMIN' && u.id !== usuarioLogado?.id && !isAdminMaster) {
      setErro('Admin comum não pode desativar outros administradores.');
      return;
    }
    
    // Não permite desativar a si mesmo
    if (u.id === usuarioLogado?.id) {
      setErro('Você não pode desativar seu próprio usuário.');
      return;
    }

    await supabase.from('usuarios').update({ ativo: !u.ativo }).eq('id', u.id);
    await carregar();
  }

  return (
    <LayoutInterno titulo="Equipe interna">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ardosia-500">
          {isAdminMaster 
            ? 'Como admin master, você pode criar usuários de Compras, Artífice e outros Admins. Não existe autocadastro no sistema.'
            : 'Somente o admin master pode criar novos administradores. Você pode criar usuários de Compras e Artífice. Não existe autocadastro no sistema.'
          }
        </p>
        <p className="text-xs text-ardosia-400 bg-ardosia-100 rounded-lg p-3">
          Depois de criado aqui, a pessoa acessa <span className="font-mono">/login</span> →
          "Primeiro acesso" e define a própria senha usando este mesmo e-mail.
        </p>

        <button className="btn-primario" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Novo usuário'}
        </button>

        {mostrarForm && (
          <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">Nome</span>
              <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">E-mail</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">Condomínio</span>
              <select
                className="input"
                value={condominioId}
                onChange={(e) => setCondominioId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {condominios.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">Papel</span>
              <select
                className="input"
                value={papel}
                onChange={(e) => setPapel(e.target.value as PapelUsuario)}
                disabled={Boolean(editando && !isAdminMaster && editando.papel === 'ADMIN')}
              >
                <option value="ARTIFICE">Artífice</option>
                <option value="COMPRAS">Compras</option>
                {(isAdminMaster || (editando?.papel === 'ADMIN')) && <option value="ADMIN">Síndico / Admin</option>}
              </select>
              {!isAdminMaster && !editando && (
                <p className="text-xs text-ardosia-400 mt-1">
                  Somente o admin master pode criar administradores.
                </p>
              )}
            </label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button className="btn-primario" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar usuário'}
            </button>
          </form>
        )}

        {carregando ? (
          <p className="text-sm text-ardosia-400">Carregando equipe...</p>
        ) : (
          <div className="card divide-y divide-ardosia-100">
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-ardosia-800">
                    {u.nome}
                    {u.papel === 'ADMIN' && u.admin_master && (
                      <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
                        Master
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ardosia-400">
                    {LABEL_PAPEL[u.papel]} · {u.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => iniciarEdicao(u)}
                    disabled={u.papel === 'ADMIN' && u.id !== usuarioLogado?.id && !isAdminMaster}
                    className={`text-xs font-semibold rounded-full px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 ${
                      (u.papel === 'ADMIN' && u.id !== usuarioLogado?.id && !isAdminMaster)
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                    title={
                      (u.papel === 'ADMIN' && u.id !== usuarioLogado?.id && !isAdminMaster)
                        ? 'Admin comum não pode editar outros administradores'
                        : 'Editar usuário'
                    }
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarAtivo(u)}
                    disabled={
                      (u.papel === 'ADMIN' && u.id !== usuarioLogado?.id && !isAdminMaster) ||
                      u.id === usuarioLogado?.id
                    }
                    className={`text-xs font-semibold rounded-full px-3 py-1 ${
                      u.ativo
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-ardosia-100 text-ardosia-500'
                    } ${
                      (u.papel === 'ADMIN' && u.id !== usuarioLogado?.id && !isAdminMaster) ||
                      u.id === usuarioLogado?.id
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                    title={
                      (u.papel === 'ADMIN' && u.id !== usuarioLogado?.id && !isAdminMaster)
                        ? 'Somente admin master pode desativar administradores'
                        : u.id === usuarioLogado?.id
                        ? 'Não pode desativar seu próprio usuário'
                        : ''
                    }
                  >
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </LayoutInterno>
  );
}
