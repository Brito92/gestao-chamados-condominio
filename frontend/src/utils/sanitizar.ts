import DOMPurify from 'dompurify';

const OPCOES_TEXTO_PLANO = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
};

/** Remove qualquer marcação HTML de texto que será armazenado no chamado. */
export function sanitizarTextoPlano(texto: string): string {
  return DOMPurify.sanitize(texto, OPCOES_TEXTO_PLANO);
}

/**
 * Retorna uma mensagem quando o valor contém marcação HTML ou atributos.
 * O valor sanitizado ainda deve ser usado no payload para proteger dados
 * legados e evitar que pequenas normalizações cheguem ao banco.
 */
export function validarTextoLivre(texto: string, campo: string): string | null {
  if (sanitizarTextoPlano(texto) !== texto) {
    return `${campo} não pode conter HTML ou marcação. Remova as tags e tente novamente.`;
  }
  return null;
}
