import { supabase, BUCKET_ANEXOS } from '@/lib/supabaseClient';
import type { TipoAnexo } from '@/types/database';
import { validarOrigemDaAcao } from '@/utils/csrf';

const MIMES_PERMITIDOS: Record<TipoAnexo, readonly string[]> = {
  FOTO_SOLICITACAO: ['image/jpeg', 'image/png', 'image/webp'],
  ORCAMENTO: ['application/pdf', 'image/jpeg', 'image/png'],
  COMPROVANTE_COMPRA: ['application/pdf', 'image/jpeg', 'image/png'],
  FOTO_ANTES: ['image/jpeg', 'image/png', 'image/webp'],
  FOTO_DEPOIS: ['image/jpeg', 'image/png', 'image/webp'],
  ANEXO_REJEICAO: ['application/pdf', 'image/jpeg', 'image/png'],
};

const TAMANHO_MAXIMO: Record<TipoAnexo, number> = {
  FOTO_SOLICITACAO: 5 * 1024 * 1024,
  ORCAMENTO: 10 * 1024 * 1024,
  COMPROVANTE_COMPRA: 5 * 1024 * 1024,
  FOTO_ANTES: 5 * 1024 * 1024,
  FOTO_DEPOIS: 5 * 1024 * 1024,
  ANEXO_REJEICAO: 5 * 1024 * 1024,
};

const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function assinaturaConfere(bytes: Uint8Array, assinatura: number[], inicio = 0) {
  return assinatura.every((valor, indice) => bytes[inicio + indice] === valor);
}

function validarMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') return assinaturaConfere(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === 'image/png') return assinaturaConfere(bytes, [0x89, 0x50, 0x4e, 0x47]);
  if (mimeType === 'application/pdf') return assinaturaConfere(bytes, [0x25, 0x50, 0x44, 0x46]);
  if (mimeType === 'image/webp') {
    return assinaturaConfere(bytes, [0x52, 0x49, 0x46, 0x46])
      && assinaturaConfere(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  }
  return false;
}

export async function validarArquivoAnexo(arquivo: File, tipo: TipoAnexo): Promise<void> {
  const origemInvalida = validarOrigemDaAcao();
  if (origemInvalida) throw new Error(origemInvalida);

  if (!MIMES_PERMITIDOS[tipo].includes(arquivo.type)) {
    throw new Error(`Arquivo inválido para ${tipo}. Tipos permitidos: ${MIMES_PERMITIDOS[tipo].join(', ')}.`);
  }

  if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO[tipo]) {
    throw new Error(`Arquivo muito grande ou vazio. O limite para este anexo é ${TAMANHO_MAXIMO[tipo] / 1024 / 1024} MB.`);
  }

  const bytes = new Uint8Array(await arquivo.slice(0, 16).arrayBuffer());
  if (!validarMagicBytes(bytes, arquivo.type)) {
    throw new Error('O conteúdo real do arquivo não corresponde ao tipo informado.');
  }
}

/**
 * Faz upload de um arquivo para o bucket de anexos e registra a linha
 * correspondente em `chamado_anexos`. Centraliza a regra de nomeação do
 * arquivo (evita colisões) para não repetir isso em cada tela.
 */
export async function enviarAnexoChamado(params: {
  chamadoId: string;
  arquivo: File;
  tipo: TipoAnexo;
  descricao?: string;
  valor?: number | null;
  enviadoPor?: string | null;
}): Promise<void> {
  const { chamadoId, arquivo, tipo, descricao, valor, enviadoPor } = params;

  await validarArquivoAnexo(arquivo, tipo);
  const extensao = EXTENSAO_POR_MIME[arquivo.type];
  const caminho = `${chamadoId}/${tipo.toLowerCase()}-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .upload(caminho, arquivo, { cacheControl: '3600', upsert: false });

  if (erroUpload) {
    throw new Error(`Falha ao enviar arquivo: ${erroUpload.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET_ANEXOS).getPublicUrl(caminho);

  const { error: erroInsert } = await supabase.from('chamado_anexos').insert({
    chamado_id: chamadoId,
    tipo,
    url: publicUrlData.publicUrl,
    descricao: descricao ?? null,
    valor: valor ?? null,
    enviado_por: enviadoPor ?? null,
  });

  if (erroInsert) {
    throw new Error(`Falha ao registrar anexo: ${erroInsert.message}`);
  }
}
