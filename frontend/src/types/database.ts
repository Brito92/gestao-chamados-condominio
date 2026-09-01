/**
 * Tipos que espelham o schema definido em `supabase/migrations`.
 * Mantidos manualmente neste MVP; quando o projeto crescer, considere
 * gerar automaticamente via `supabase gen types typescript`.
 */

export type PapelUsuario = 'ADMIN' | 'COMPRAS' | 'ARTIFICE';

export type TipoProblema = 'ELETRICA' | 'HIDRAULICA' | 'REFORMA' | 'OUTROS';

export type StatusChamado =
  | 'EM_ANALISE'
  | 'REJEITADO'
  | 'EM_COMPRAS'
  | 'AGUARDANDO_EXECUCAO'
  | 'EM_ANDAMENTO'
  | 'FINALIZADO'
  | 'CANCELADO';

export type TipoAnexo =
  | 'FOTO_SOLICITACAO'
  | 'ANEXO_REJEICAO'
  | 'ORCAMENTO'
  | 'COMPROVANTE_COMPRA'
  | 'FOTO_ANTES'
  | 'FOTO_DEPOIS';

export interface Condominio {
  id: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface Usuario {
  id: string;
  auth_user_id: string | null;
  nome: string;
  email: string;
  whatsapp: string | null;
  papel: PapelUsuario;
  condominio_id: string | null;
  ativo: boolean;
  criado_em: string;
  criado_por: string | null;
  admin_master: boolean;
}

export interface Chamado {
  id: string;
  numero_chamado: string | null;
  condominio_id: string;
  morador_nome: string;
  morador_whatsapp: string;
  morador_email: string | null;
  local_problema: string;
  tipo_problema: TipoProblema;
  descricao: string;
  status: StatusChamado;
  motivo_rejeicao: string | null;
  observacao_compras: string | null;
  observacao_aprovacao: string | null;
  aprovado_por: string | null;
  compras_por: string | null;
  artifice_id: string | null;
  criado_em: string;
  aprovado_em: string | null;
  em_compras_em: string | null;
  aguardando_execucao_em: string | null;
  em_andamento_em: string | null;
  finalizado_em: string | null;
  cancelado_em: string | null;
  rejeitado_em: string | null;
  atualizado_em: string;
  artifice_atribuido_por: string | null;
  artifice_atribuido_em: string | null;
  observacao_artifice: string | null;
  executado: boolean;
  motivo_nao_execucao: string | null;
  chat_aberto_em: string | null;
  observacao_reabertura: string | null;
  reaberto_em: string | null;
  assumido_por: string | null;
  assumido_em: string | null;
  bloqueio_expira_em: string | null;
  versao: number;
}

export interface SolicitacaoMensagem {
  id: string;
  chamado_id: string;
  remetente: 'ADMIN' | 'MORADOR';
  usuario_id: string | null;
  mensagem: string;
  criado_em: string;
}

export interface ChamadoAnexo {
  id: string;
  chamado_id: string;
  tipo: TipoAnexo;
  url: string;
  descricao: string | null;
  valor: number | null;
  enviado_por: string | null;
  criado_em: string;
}

export interface ChamadoHistorico {
  id: string;
  chamado_id: string;
  status_anterior: StatusChamado | null;
  status_novo: StatusChamado;
  observacao: string | null;
  usuario_id: string | null;
  criado_em: string;
  evento: string;
  detalhes: Record<string, unknown>;
  usuario?: Pick<Usuario, 'id' | 'nome' | 'papel'> | null;
}

/** Chamado com seus relacionamentos carregados, usado nas telas de detalhe. */
export interface ChamadoCompleto extends Chamado {
  anexos: ChamadoAnexo[];
  historico: ChamadoHistorico[];
  artifice?: Pick<Usuario, 'id' | 'nome'> | null;
}
