import type { Chamado, ChamadoAnexo, StatusChamado } from '@/types/database';

export const SLA_HORAS_POR_STATUS: Partial<Record<StatusChamado, number>> = {
  EM_ANALISE: 24,
  ENVIADO_PARA_COMPRAS: 24,
  EM_COMPRAS: 48,
  ENVIADO_PARA_EXECUCAO: 24,
  AGUARDANDO_EXECUCAO: 24,
  EM_ANDAMENTO: 72,
  PENDENTE: 24,
};

export type SituacaoSla = 'SEM_SLA' | 'NO_PRAZO' | 'ATRASADO';

export function obterSituacaoSla(chamado: Pick<Chamado, 'status' | 'atualizado_em'>, agora = new Date()): {
  situacao: SituacaoSla;
  horasDecorridas: number;
  limiteHoras: number | null;
} {
  const limiteHoras = SLA_HORAS_POR_STATUS[chamado.status] ?? null;
  const horasDecorridas = Math.max(0, (agora.getTime() - new Date(chamado.atualizado_em).getTime()) / 3_600_000);
  if (limiteHoras === null) return { situacao: 'SEM_SLA', horasDecorridas, limiteHoras };
  return {
    situacao: horasDecorridas > limiteHoras ? 'ATRASADO' : 'NO_PRAZO',
    horasDecorridas,
    limiteHoras,
  };
}

export function calcularGastoTotal(anexos: Pick<ChamadoAnexo, 'tipo' | 'valor'>[]): number {
  return anexos
    .filter((anexo) => anexo.tipo === 'COMPROVANTE_COMPRA')
    .reduce((total, anexo) => total + Number(anexo.valor ?? 0), 0);
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
