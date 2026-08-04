import { useEffect, useState, type FormEvent } from 'react';
import { LayoutInterno } from '@/components/LayoutInterno';
import { supabase } from '@/lib/supabaseClient';
import type { Condominio } from '@/types/database';

export function AdminCondominios() {
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('condominios')
      .select('*')
      .order('nome', { ascending: true })
      .returns<Condominio[]>();
    setCondominios(data ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('O nome do condomínio é obrigatório.');
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.from('condominios').insert({
        nome: nome.trim(),
        endereco: endereco.trim() || null,
      });
      if (error) throw error;

      setNome('');
      setEndereco('');
      setMostrarForm(false);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar o condomínio.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c: Condominio) {
    if (!confirm(`Excluir o condomínio "${c.nome}"? Essa ação não pode ser desfeita.`)) return;

    setErro(null);
    setExcluindoId(c.id);
    try {
      const { error } = await supabase.from('condominios').delete().eq('id', c.id);
      if (error) throw error;
      await carregar();
    } catch {
      setErro(
        'Não foi possível excluir. Verifique se ainda existem usuários ou chamados vinculados a este condomínio.'
      );
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <LayoutInterno titulo="Condomínios">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ardosia-500">
          Cadastre os condomínios atendidos pelo sistema ou remova um que não é mais utilizado.
        </p>

        <button className="btn-primario" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Novo condomínio'}
        </button>

        {mostrarForm && (
          <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">Nome</span>
              <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ardosia-700 mb-1.5">Endereço</span>
              <input
                className="input"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro"
              />
            </label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button className="btn-primario" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Criar condomínio'}
            </button>
          </form>
        )}

        {!mostrarForm && erro && <p className="text-sm text-red-600">{erro}</p>}

        {carregando ? (
          <p className="text-sm text-ardosia-400">Carregando condomínios...</p>
        ) : (
          <div className="card divide-y divide-ardosia-100">
            {condominios.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 gap-3">
                <div>
                  <p className="text-sm font-semibold text-ardosia-800">{c.nome}</p>
                  <p className="text-xs text-ardosia-400">{c.endereco ?? 'Sem endereço'}</p>
                </div>
                <button
                  onClick={() => excluir(c)}
                  disabled={excluindoId === c.id}
                  className="btn-perigo text-xs font-semibold px-3 py-1.5"
                >
                  {excluindoId === c.id ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            ))}
            {condominios.length === 0 && (
              <p className="text-sm text-ardosia-400 py-3">Nenhum condomínio cadastrado.</p>
            )}
          </div>
        )}
      </div>
    </LayoutInterno>
  );
}
