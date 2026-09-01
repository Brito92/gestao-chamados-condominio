import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutInterno } from '@/components/LayoutInterno';
import { supabase } from '@/lib/supabaseClient';
import { StatusBadge } from '@/components/StatusBadge';
import type { Chamado, ChamadoAnexo, Condominio, StatusChamado } from '@/types/database';
import { STATUS_META } from '@/utils/statusChamado';

interface Metricas {
  porStatus: Record<StatusChamado, number>;
  total: number;
  slaMedioHoras: number | null;
  gastoTotal: number;
  ultimosChamados: Chamado[];
}

const STATUS_ORDEM: StatusChamado[] = [
  'EM_ANALISE',
  'EM_COMPRAS',
  'AGUARDANDO_EXECUCAO',
  'EM_ANDAMENTO',
  'FINALIZADO',
  'REJEITADO',
  'CANCELADO',
];

export function AdminDashboard() {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [condominioSelecionado, setCondominioSelecionado] = useState<string | null>(null);

  /**
   * Calcula o primeiro e último dia do mês vigente em ISO 8601
   * Necessário para filtrar chamados no Supabase
   */
  function obterPeriodoMesVigente() {
    const agora = new Date();
    const primeiroDay = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const ultimoDay = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    // Formatar em ISO 8601 para Supabase (YYYY-MM-DD HH:mm:ss)
    const inicioMes = primeiroDay.toISOString();
    const fimMes = ultimoDay.toISOString();

    return { inicioMes, fimMes, mes: agora.getMonth() + 1, ano: agora.getFullYear() };
  }

  useEffect(() => {
    async function carregarCondominios() {
      const { data } = await supabase
        .from('condominios')
        .select('id, nome')
        .order('nome')
        .returns<Condominio[]>();
      setCondominios(data ?? []);
    }
    carregarCondominios();
  }, []);

  useEffect(() => {
    async function carregar() {
      const { inicioMes, fimMes } = obterPeriodoMesVigente();

      let query = supabase
        .from('chamados')
        .select('*')
        .gte('criado_em', inicioMes)
        .lte('criado_em', fimMes)
        .order('criado_em', { ascending: false });

      // Se um condomínio foi selecionado, filtrar por ele
      if (condominioSelecionado) {
        query = query.eq('condominio_id', condominioSelecionado);
      }

      const { data: chamados } = await query.returns<Chamado[]>();

      // Buscar anexos com valor apenas dos chamados carregados
      const chamadosIds = (chamados ?? []).map((c) => c.id);
      let anexosQuery = supabase.from('chamado_anexos').select('*').not('valor', 'is', null);
      if (chamadosIds.length > 0) {
        anexosQuery = anexosQuery.in('chamado_id', chamadosIds);
      } else {
        // Se não há chamados, não traz nenhum anexo
        const { data: anexosComValor } = await anexosQuery.returns<ChamadoAnexo[]>();
        setMetricas({
          porStatus: STATUS_ORDEM.reduce((acc, status) => {
            acc[status] = 0;
            return acc;
          }, {} as Record<StatusChamado, number>),
          total: 0,
          slaMedioHoras: null,
          gastoTotal: 0,
          ultimosChamados: [],
        });
        return;
      }

      const { data: anexosComValor } = await anexosQuery.returns<ChamadoAnexo[]>();

      const lista = chamados ?? [];

      const porStatus = STATUS_ORDEM.reduce((acc, status) => {
        acc[status] = lista.filter((c) => c.status === status).length;
        return acc;
      }, {} as Record<StatusChamado, number>);

      const finalizados = lista.filter((c) => c.finalizado_em);
      const slaMedioHoras =
        finalizados.length > 0
          ? finalizados.reduce((soma, c) => {
              const inicio = new Date(c.criado_em).getTime();
              const fim = new Date(c.finalizado_em as string).getTime();
              return soma + (fim - inicio) / 3_600_000;
            }, 0) / finalizados.length
          : null;

      const gastoTotal = (anexosComValor ?? []).reduce((soma, a) => soma + Number(a.valor ?? 0), 0);

      setMetricas({
        porStatus,
        total: lista.length,
        slaMedioHoras,
        gastoTotal,
        ultimosChamados: lista.slice(0, 5),
      });
    }
    carregar();
  }, [condominioSelecionado]);

  return (
    <LayoutInterno 
      titulo={`Painel geral - ${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()).replace(/\b\w/g, l => l.toUpperCase())}`}
    >
      {!metricas ? (
        <p className="text-sm text-ardosia-400">Carregando métricas...</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <label className="block">
              <span className="block text-xs font-medium text-ardosia-600 mb-1.5">
                Filtrar por condomínio
              </span>
              <select
                className="input"
                value={condominioSelecionado ?? ''}
                onChange={(e) => setCondominioSelecionado(e.target.value || null)}
              >
                <option value="">Todos os condomínios</option>
                {condominios.map((cond) => (
                  <option key={cond.id} value={cond.id}>
                    {cond.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CardMetrica
              titulo="Total de chamados"
              valor={metricas.total}
              destaque
            />
            <CardMetrica
              titulo="SLA médio de conclusão"
              valor={
                metricas.slaMedioHoras !== null
                  ? `${metricas.slaMedioHoras.toFixed(1)}h`
                  : '—'
              }
            />
            <CardMetrica
              titulo="Gasto total registrado"
              valor={metricas.gastoTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            />
            <CardMetrica
              titulo="Aguardando análise"
              valor={metricas.porStatus.EM_ANALISE}
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ardosia-700 mb-3">Chamados por status</h2>
            <div className="card divide-y divide-ardosia-100">
              {STATUS_ORDEM.map((status) => (
                <div key={status} className="flex items-center justify-between py-3 hover:bg-ardosia-50 transition-colors duration-150 -mx-4 px-4 first:rounded-t-2xl last:rounded-b-2xl">
                  <StatusBadge status={status} />
                  <span className="font-mono font-semibold text-ardosia-700">
                    {metricas.porStatus[status]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ardosia-700">Chamados recentes</h2>
              <Link to="/interno/admin/chamados" className="text-xs text-ambar-700 font-medium hover:text-ambar-600 transition-colors">
                Ver todos
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {metricas.ultimosChamados.map((c) => (
                <Link
                  key={c.id}
                  to={`/interno/admin/chamados/${c.id}`}
                  className="card flex items-center justify-between py-3 px-4 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ardosia-800 truncate">{c.local_problema}</p>
                    <p className="text-xs text-ardosia-400 truncate">
                      {c.numero_chamado ?? STATUS_META[c.status].label}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </LayoutInterno>
  );
}

function CardMetrica({
  titulo,
  valor,
  destaque,
}: {
  titulo: string;
  valor: string | number;
  destaque?: boolean;
}) {
  return (
    <div className={`card ${destaque ? 'bg-ardosia-800 border-ardosia-800' : ''}`}>
      <p className={`text-xs ${destaque ? 'text-ardosia-200' : 'text-ardosia-400'}`}>{titulo}</p>
      <p
        className={`text-2xl font-display font-bold mt-1 ${destaque ? 'text-white' : 'text-ardosia-800'}`}
      >
        {valor}
      </p>
    </div>
  );
}
