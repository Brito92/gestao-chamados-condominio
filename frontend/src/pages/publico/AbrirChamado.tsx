import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutPublico } from '@/components/LayoutPublico';
import { MultiImageUpload } from '@/components/MultiImageUpload';
import { supabase } from '@/lib/supabaseClient';
import { enviarAnexoChamado } from '@/utils/uploadAnexo';
import { usePersistedState } from '@/hooks/usePersistedState';
import { TIPO_PROBLEMA_LABEL } from '@/utils/statusChamado';
import { validarWhatsApp } from '@/utils/validarContato';
import { emailValido } from '@/utils/fluxoChamado';
import type { TipoProblema, Condominio } from '@/types/database';

export function AbrirChamado() {
  const navigate = useNavigate();
  const [nome, setNome, limparNome] = usePersistedState('rascunho:publico:nome', '');
  const [whatsapp, setWhatsapp, limparWhatsapp] = usePersistedState('rascunho:publico:whatsapp', '');
  const [email, setEmail, limparEmail] = usePersistedState('rascunho:publico:email', '');
  const [local, setLocal, limparLocal] = usePersistedState('rascunho:publico:local', '');
  const [tipo, setTipo, limparTipo] = usePersistedState<TipoProblema>('rascunho:publico:tipo', 'OUTROS');
  const [descricao, setDescricao, limparDescricao] = usePersistedState('rascunho:publico:descricao', '');
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroWhatsapp, setErroWhatsapp] = useState<string | null>(null);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [condominioSelecionado, setCondominioSelecionado, limparCondominio] = usePersistedState('rascunho:publico:condominio', '');
  const [carregandoCondominios, setCarregandoCondominios] = useState(true);
  const [etapa, setEtapa] = useState<'formulario' | 'revisao'>('formulario');

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

  // Valida WhatsApp em tempo real conforme o usuário digita
  function handleWhatsappChange(valor: string) {
    setWhatsapp(valor);
    if (valor.trim()) {
      const validacao = validarWhatsApp(valor);
      setErroWhatsapp(validacao.erro || null);
    } else {
      setErroWhatsapp(null);
    }
  }

  function validarFormulario() {
    setErro(null);

    if (!nome.trim() || !email.trim() || !whatsapp.trim() || !local.trim() || !descricao.trim()) {
      setErro('Preencha todos os campos obrigatórios.');
      return false;
    }

    if (!condominioSelecionado) {
      setErro('Selecione um condomínio.');
      return false;
    }

    if (!emailValido(email)) {
      setErro('Informe um e-mail válido para receber o protocolo e as atualizações.');
      return false;
    }

    const validacaoWhatsapp = validarWhatsApp(whatsapp);
    if (!validacaoWhatsapp.valido) {
      setErro(validacaoWhatsapp.erro ?? 'WhatsApp inválido');
      return false;
    }

    return true;
  }

  function prepararRevisao(e: FormEvent) {
    e.preventDefault();
    if (validarFormulario()) setEtapa('revisao');
  }

  async function confirmarEnvio() {
    if (!validarFormulario()) return;

    setEnviando(true);
    try {
      const chamadoId = crypto.randomUUID();
      const { data: chamadoCriado, error } = await supabase
        .rpc('abrir_chamado_publico', {
          p_id: chamadoId,
          p_condominio_id: condominioSelecionado,
          p_morador_nome: nome.trim(),
          p_morador_whatsapp: whatsapp.trim(),
          p_morador_email: email.trim().toLowerCase(),
          p_local_problema: local.trim(),
          p_tipo_problema: tipo,
          p_descricao: descricao.trim(),
        })
        .single<{ id: string; numero_chamado: string }>();

      if (error) throw error;

      // Faz upload de todas as fotos
      if (fotos.length > 0) {
        await Promise.all(
          fotos.map((foto) =>
            enviarAnexoChamado({
              chamadoId,
              arquivo: foto,
              tipo: 'FOTO_SOLICITACAO',
            })
          )
        );
      }

      limparNome();
      limparWhatsapp();
      limparEmail();
      limparLocal();
      limparTipo();
      limparDescricao();
      limparCondominio();
      setFotos([]);
      navigate('/abrir-chamado/sucesso', { state: { numeroChamado: chamadoCriado?.numero_chamado } });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LayoutPublico titulo="Relatar um problema" voltarPara="/">
      <form onSubmit={prepararRevisao} className="flex flex-col gap-5">
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

        {etapa === 'formulario' ? (
          <>
        <Campo label="Seu nome" obrigatorio>
          <input
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Maria Souza"
          />
        </Campo>

        <Campo label="E-mail para contato" obrigatorio>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="email"
          />
        </Campo>

        <Campo label="WhatsApp para contato" obrigatorio>
          <input
            className={`input ${erroWhatsapp ? 'border-red-500 focus:ring-red-200' : ''}`}
            value={whatsapp}
            onChange={(e) => handleWhatsappChange(e.target.value)}
            placeholder="(92) 99999-0000"
            inputMode="tel"
          />
          {erroWhatsapp && (
            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
              ⚠️ {erroWhatsapp}
            </p>
          )}
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
          maxImagens={3}
        />

          </>
        ) : (
          <div className="card flex flex-col gap-4 border-ambar-500/40">
            <div>
              <p className="text-xs uppercase tracking-wide text-ambar-700 font-semibold">Revise antes de enviar</p>
              <h2 className="text-lg font-bold text-ardosia-900 mt-1">Confira os dados da solicitação</h2>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Resumo label="Condomínio" valor={condominios.find((c) => c.id === condominioSelecionado)?.nome ?? '—'} />
              <Resumo label="Morador" valor={nome} />
              <Resumo label="E-mail" valor={email} />
              <Resumo label="WhatsApp" valor={whatsapp} />
              <Resumo label="Local" valor={local} />
              <Resumo label="Tipo" valor={TIPO_PROBLEMA_LABEL[tipo]} />
            </div>
            <Resumo label="Descrição" valor={descricao} />
            <p className="text-xs text-ardosia-500">{fotos.length} foto(s) anexada(s). O protocolo será gerado imediatamente.</p>
            <button type="button" className="btn-secundario" onClick={() => setEtapa('formulario')}>
              Voltar e editar
            </button>
          </div>
        )}

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
            {erro}
          </p>
        )}

        <button
          type={etapa === 'formulario' ? 'submit' : 'button'}
          onClick={etapa === 'revisao' ? confirmarEnvio : undefined}
          disabled={enviando}
          className="bg-ambar-500 hover:bg-ambar-600 active:bg-ambar-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 text-ardosia-950 font-semibold rounded-2xl px-6 py-4 mt-2 shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
        >
          {enviando ? 'Enviando...' : etapa === 'formulario' ? 'Revisar solicitação' : 'Confirmar e enviar'}
        </button>
      </form>
    </LayoutPublico>
  );
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl bg-ardosia-50 border border-ardosia-100 p-3">
      <p className="text-xs text-ardosia-400">{label}</p>
      <p className="font-medium text-ardosia-800 whitespace-pre-wrap break-words">{valor || '—'}</p>
    </div>
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
