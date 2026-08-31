import imageCompression from 'browser-image-compression';

interface OpcoesCompressao {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  qualidade?: number;
}

/**
 * Comprime uma imagem para economizar espaço em storage
 * Reduz tamanho em até 90% mantendo qualidade visual aceitável
 *
 * @param arquivo - Arquivo de imagem para comprimir
 * @param opcoes - Opções de compressão (opcional)
 * @returns Arquivo comprimido (ou original se falhar)
 *
 * @example
 * const fotoComprimida = await comprimirFoto(foto, {
 *   maxSizeMB: 0.4,
 *   maxWidthOrHeight: 1024,
 *   qualidade: 0.65
 * });
 */
export async function comprimirFoto(
  arquivo: File,
  opcoes?: OpcoesCompressao
): Promise<{ arquivo: File; tamanhoOriginal: number; tamanhoComprimido: number; reducao: number }> {
  const opcoesPadrao = {
    maxSizeMB: 0.4, // 400KB máximo
    maxWidthOrHeight: 1024, // Resolução máxima
    useWebWorker: true, // Processa em thread separada
    fileType: 'image/webp', // Formato mais eficiente
  };

  try {
    const fotoComprimida = await imageCompression(arquivo, {
      ...opcoesPadrao,
      ...(opcoes && {
        maxSizeMB: opcoes.maxSizeMB,
        maxWidthOrHeight: opcoes.maxWidthOrHeight,
      }),
    });

    const tamanhoOriginal = arquivo.size;
    const tamanhoComprimido = fotoComprimida.size;
    const reducao = 100 - (tamanhoComprimido / tamanhoOriginal) * 100;

    console.log(`📷 Foto comprimida:`);
    console.log(`   Original: ${(tamanhoOriginal / 1024).toFixed(2)}KB`);
    console.log(`   Comprimida: ${(tamanhoComprimido / 1024).toFixed(2)}KB`);
    console.log(`   Redução: ${reducao.toFixed(1)}%`);

    return {
      arquivo: fotoComprimida,
      tamanhoOriginal,
      tamanhoComprimido,
      reducao,
    };
  } catch (erro) {
    console.error('❌ Erro ao comprimir foto:', erro);
    // Retorna original se falhar
    return {
      arquivo,
      tamanhoOriginal: arquivo.size,
      tamanhoComprimido: arquivo.size,
      reducao: 0,
    };
  }
}

/**
 * Comprime múltiplas imagens em paralelo
 *
 * @param arquivos - Array de imagens
 * @param opcoes - Opções de compressão
 * @returns Array com resultados de compressão
 */
export async function comprimirFotos(
  arquivos: File[],
  opcoes?: OpcoesCompressao
): Promise<{
  arquivos: File[];
  estatisticas: { tamanhoOriginal: number; tamanhoComprimido: number; reducao: number };
}> {
  try {
    const resultados = await Promise.all(arquivos.map((arquivo) => comprimirFoto(arquivo, opcoes)));

    const tamanhoOriginal = resultados.reduce((sum, r) => sum + r.tamanhoOriginal, 0);
    const tamanhoComprimido = resultados.reduce((sum, r) => sum + r.tamanhoComprimido, 0);
    const reducao = 100 - (tamanhoComprimido / tamanhoOriginal) * 100;

    return {
      arquivos: resultados.map((r) => r.arquivo),
      estatisticas: {
        tamanhoOriginal,
        tamanhoComprimido,
        reducao,
      },
    };
  } catch (erro) {
    console.error('❌ Erro ao comprimir múltiplas fotos:', erro);
    return {
      arquivos,
      estatisticas: { tamanhoOriginal: 0, tamanhoComprimido: 0, reducao: 0 },
    };
  }
}

/**
 * Formata bytes para formato legível
 *
 * @param bytes - Tamanho em bytes
 * @returns String formatada (ex: "1.5MB")
 */
export function formatarTamanho(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const tamanhos = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + tamanhos[i];
}
