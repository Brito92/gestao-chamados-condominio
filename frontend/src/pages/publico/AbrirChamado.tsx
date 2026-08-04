import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutPublico } from '@/components/LayoutPublico';
import { MultiImageUpload } from '@/components/MultiImageUpload';
import { supabase } from '@/lib/supabaseClient';
import { enviarAnexoChamado } from '@/utils/uploadAnexo';
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';
import type { TipoProblema, Condominio } from '@/types/database';

export function AbrirChamado() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [local, setLocal] = useState('');
  const [tipo, setTipo] = useState<TipoProblema>('OUTROS');
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [condominioSelecionado, setCondominioSelecionado] = useState('');
  const [carregandoCondominios, setCarregandoCondominios] = useState(true);

  // Carrega lista de condominios ao montar
  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('condominios')
        .select('id, nome, endereco, ativo, criado_em')
        .eq('ativo', true)
        .order('nome');

      if (error) {
        setErro(`Erro ao carregar condominios: ${error.message}`);
      } else {
        setCondominios(data || []);
        // Se houver apenas um, seleciona automaticamente
        if (data && data.length === 1) {
          setCondominioSelecionado(data[0].id);
        }
      }
      setCarregandoCondominios(false);
    }

    carregar();
  }, []);

  /**
   * Valida formato de WhatsApp: extrai dígitos e verifica se tem 10 ou 11 dígitos.
   * Aceita formatos como: (99) 99999-9999, 99999999999, +55 99 99999-9999
   */
  function validarWhatsApp(valor: string): boolean {
    const apenasDigitos = valor.replace(/\D/g, '');
    // Remove código do país se começar com 55
    const semPais = apenasDigitos.startsWith('55')
      ? apenasDigitos.slice(2)
      : apenasDigitos;
    return semPais.length === 10 || semPais.length === 11;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !whatsapp.trim() || !local.trim() || !descricao.trim()) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!condominioSelecionado) {
      setErro('Selecione um condomínio.');
      return;
    }

    if (!validarWhatsApp(whatsapp)) {
      setErro('WhatsApp inválido. Use formato com 10 ou 11 dígitos (ex: (92) 99999-0000).');
      return;
    }

    setEnviando(true);
    try {
      const { data: chamado, error } = await supabase
        .from('chamados')
        .insert({
          condominio_id: condominioSelecionado,
          morador_nome: nome.trim(),
          morador_whatsapp: whatsapp.trim(),
          local_problema: local.trim(),
          tipo_problema: tipo,
          descricao: descricao.trim(),
        })
        .select('id')
        .single();

      if (error) throw error;

      // Faz upload de todas as fotos
      if (fotos.length > 0 && chamado) {
        await Promise.all(
          fotos.map((foto) =>
            enviarAnexoChamado({
              chamadoId: chamado.id,
              arquivo: foto,
              tipo: 'FOTO_SOLICITACAO',
            })
          )
        );
      }

      navigate('/abrir-chamado/sucesso');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutPublico titulo="Relatar um problema" voltarPara="/">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <p className="text-sm text-ardosia-500 leading-relaxed">
          Conte o que está acontecendo. O síndico vai analisar e você receberá as
          atualizações pelo WhatsApp informado.
        </p>

        <Campo label="Condomínio" obrigatorio>
          <select
            className="input"
            value={condominioSelecionado}
            onChange={(e) => setCondominioSelecionado(e.target.value)}
            disabled={carregandoCondominios}
          >
            <option value="">
              {carregandoCondominios ? 'Carregando...' : 'Selecione um condomínio'}
            </option>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Seu nome" obrigatorio>
          <input
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Maria Souza"
          />
        </Campo>

        <Campo label="WhatsApp para contato" obrigatorio>
          <input
            className="input"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(92) 99999-0000"
            inputMode="tel"
          />
        </Campo>

        <Campo label="Local do problema" obrigatorio>
          <input
            className="input"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Ex: Bloco B - Apto 302"
          />
        </Campo>

        <Campo label="Tipo do problema" obrigatorio>
          <select
            className="input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoProblema)}
          >
            {Object.entries(TIPO_PROBLEMA_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Descreva o problema" obrigatorio>
          <textarea
            className="input min-h-[120px] resize-none"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva com detalhes o que está acontecendo..."
          />
        </Campo>

        <MultiImageUpload
          label="Fotos do problema (opcional)"
          arquivos={fotos}
          onChange={setFotos}
          maxImagens={5}
        />

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="bg-ambar-500 hover:bg-ambar-600 active:bg-ambar-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 text-ardosia-950 font-semibold rounded-2xl px-6 py-4 mt-2 shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
        >
          {enviando ? 'Enviando...' : 'Enviar solicitação'}
        </button>
      </form>
    </LayoutPublico>
  );
}

function Campo({
  label,
  obrigatorio,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ardosia-700 mb-1.5">
        {label} {obrigatorio && <span className="text-ambar-600">*</span>}
      </span>
      {children}
    </label>
  );
}
