import type { StatusChamado, TipoProblema } from '@/types/database';

/**
 * Metadados visuais e textuais de cada status. Centralizar aqui evita
 * strings soltas espalhadas pelas telas e garante consistência visual.
 */
export const STATUS_META: Record<
  StatusChamado,
  { label: string; corBadge: string; corTexto: string; descricao: string }
> = {
  EM_ANALISE: {
    label: 'Em análise',
    corBadge: 'bg-ardosia-100',
    corTexto: 'text-ardosia-700',
    descricao: 'O síndico está avaliando a solicitação.',
  },
  ENVIADO_PARA_COMPRAS: {
    label: 'Enviado para compras',
    corBadge: 'bg-ambar-100',
    corTexto: 'text-ambar-800',
    descricao: 'A solicitação foi aprovada e aguarda um comprador assumir.',
  },
  REJEITADO: {
    label: 'Rejeitado',
    corBadge: 'bg-red-100',
    corTexto: 'text-red-700',
    descricao: 'A solicitação não foi aprovada.',
  },
  EM_COMPRAS: {
    label: 'Em compras',
    corBadge: 'bg-ambar-100',
    corTexto: 'text-ambar-800',
    descricao: 'O setor de compras está avaliando os materiais necessários.',
  },
  ENVIADO_PARA_EXECUCAO: {
    label: 'Enviado para execução',
    corBadge: 'bg-blue-100',
    corTexto: 'text-blue-700',
    descricao: 'Compras concluiu a análise e enviou o chamado para execução.',
  },
  AGUARDANDO_EXECUCAO: {
    label: 'Aguardando execução',
    corBadge: 'bg-blue-100',
    corTexto: 'text-blue-700',
    descricao: 'Pronto para um artífice iniciar o serviço.',
  },
  EM_ANDAMENTO: {
    label: 'Em andamento',
    corBadge: 'bg-ambar-100',
    corTexto: 'text-ambar-800',
    descricao: 'O artífice está executando o serviço.',
  },
  PENDENTE: {
    label: 'Pendente',
    corBadge: 'bg-orange-100',
    corTexto: 'text-orange-700',
    descricao: 'Há uma observação registrada e o serviço ainda não foi concluído.',
  },
  FINALIZADO: {
    label: 'Finalizado',
    corBadge: 'bg-emerald-100',
    corTexto: 'text-emerald-700',
    descricao: 'Serviço concluído.',
  },
  NAO_EXECUTADO: {
    label: 'Não executado',
    corBadge: 'bg-red-100',
    corTexto: 'text-red-700',
    descricao: 'O serviço não foi executado. Consulte a justificativa.',
  },
  CANCELADO: {
    label: 'Cancelado',
    corBadge: 'bg-ardosia-200',
    corTexto: 'text-ardosia-700',
    descricao: 'Chamado encerrado sem execução.',
  },
};

export const TIPO_PROBLEMA_LABEL: Record<TipoProblema, string> = {
  ELETRICA: 'Elétrica',
  HIDRAULICA: 'Hidráulica',
  REFORMA: 'Reforma',
  OUTROS: 'Outros',
};

/**
 * Grafo de transições válidas, espelhando `status_transicoes_validas` no
 * banco. Usado apenas para UX (habilitar/desabilitar ações na tela); a
 * validação definitiva e autoritativa acontece via trigger no Postgres.
 */
export const TRANSICOES_VALIDAS: Record<StatusChamado, StatusChamado[]> = {
  EM_ANALISE: ['ENVIADO_PARA_COMPRAS', 'REJEITADO', 'CANCELADO'],
  ENVIADO_PARA_COMPRAS: ['EM_COMPRAS', 'CANCELADO'],
  REJEITADO: [],
  EM_COMPRAS: ['ENVIADO_PARA_EXECUCAO', 'CANCELADO'],
  ENVIADO_PARA_EXECUCAO: ['AGUARDANDO_EXECUCAO', 'CANCELADO'],
  AGUARDANDO_EXECUCAO: ['EM_ANDAMENTO', 'PENDENTE', 'NAO_EXECUTADO', 'CANCELADO'],
  EM_ANDAMENTO: ['PENDENTE', 'FINALIZADO', 'NAO_EXECUTADO', 'CANCELADO'],
  PENDENTE: ['EM_ANDAMENTO', 'FINALIZADO', 'NAO_EXECUTADO', 'CANCELADO'],
  FINALIZADO: ['EM_ANALISE'],
  NAO_EXECUTADO: ['EM_ANALISE'],
  CANCELADO: [],
};

export function podeTransitar(origem: StatusChamado, destino: StatusChamado): boolean {
  return TRANSICOES_VALIDAS[origem]?.includes(destino) ?? false;
}

/** Ordem cronológica "feliz" usada para desenhar a barra de progresso. */
export const ETAPAS_FLUXO_PRINCIPAL: StatusChamado[] = [
  'EM_ANALISE',
  'ENVIADO_PARA_COMPRAS',
  'EM_COMPRAS',
  'ENVIADO_PARA_EXECUCAO',
  'AGUARDANDO_EXECUCAO',
  'EM_ANDAMENTO',
  'FINALIZADO',
];
