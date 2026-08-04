import { supabase, BUCKET_ANEXOS } from '@/lib/supabaseClient';
import type { TipoAnexo } from '@/types/database';

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
  enviadoPor?: string | null;
}): Promise<void> {
  const { chamadoId, arquivo, tipo, descricao, enviadoPor } = params;

  const extensao = arquivo.name.split('.').pop() ?? 'bin';
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
    enviado_por: enviadoPor ?? null,
  });

  if (erroInsert) {
    throw new Error(`Falha ao registrar anexo: ${erroInsert.message}`);
  }
}
