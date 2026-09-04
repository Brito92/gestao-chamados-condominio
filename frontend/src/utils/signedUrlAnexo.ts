import { BUCKET_ANEXOS, supabase } from '@/lib/supabaseClient';

const PREFIXO_PUBLICO = '/storage/v1/object/public/chamados-anexos/';

export function extrairCaminhoAnexo(valor: string): string {
  if (!valor.startsWith('http')) return valor;

  const url = new URL(valor);
  const indice = url.pathname.indexOf(PREFIXO_PUBLICO);

  if (indice === -1) return valor;

  return decodeURIComponent(url.pathname.slice(indice + PREFIXO_PUBLICO.length));
}

export async function criarSignedUrlAnexo(valor: string): Promise<string> {
  const caminho = extrairCaminhoAnexo(valor);

  const { data, error } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .createSignedUrl(caminho, 60 * 10);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Não foi possível carregar o anexo.');
  }

  return data.signedUrl;
}