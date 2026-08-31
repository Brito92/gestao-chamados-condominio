/**
 * Valida e formata telefone/WhatsApp brasileiro
 * Aceita formatos: (92) 99999-9999, 92999999999, +55 92 99999-9999, etc
 * @param valor - Valor a validar
 * @returns Objeto com validação e mensagem de erro
 */
export function validarWhatsApp(valor: string): { valido: boolean; erro?: string; formatado?: string } {
  if (!valor.trim()) {
    return { valido: false, erro: 'WhatsApp é obrigatório.' };
  }

  // Extrai apenas dígitos
  const apenasDigitos = valor.replace(/\D/g, '');

  // Remove código do país (55) se começar com ele
  const semPais = apenasDigitos.startsWith('55') ? apenasDigitos.slice(2) : apenasDigitos;

  // Valida se tem 10 ou 11 dígitos
  if (semPais.length !== 10 && semPais.length !== 11) {
    return {
      valido: false,
      erro: 'WhatsApp inválido. Use 10 ou 11 dígitos (ex: 92 99999-0000 ou (92) 99999-0000)',
    };
  }

  // Valida se começa com 9 (segundo dígito deve ser 9 para celular)
  if (semPais[0] !== '9') {
    return {
      valido: false,
      erro: 'Use um número de celular com WhatsApp (deve começar com 9)',
    };
  }

  // Formata para exibição: (XX) 99999-9999 ou (XX) 999999-9999
  const ddd = semPais.substring(0, 2);
  const numero = semPais.substring(2);
  const formatado = `(${ddd}) ${numero.substring(0, 5)}-${numero.substring(5)}`;

  return { valido: true, formatado };
}

/**
 * Valida email simples
 * @param valor - Email a validar
 * @returns Objeto com validação e mensagem de erro
 */
export function validarEmail(valor: string): { valido: boolean; erro?: string } {
  if (!valor.trim()) {
    return { valido: true }; // Email é opcional
  }

  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!regexEmail.test(valor.trim())) {
    return {
      valido: false,
      erro: 'E-mail inválido. Use o formato: seu@email.com',
    };
  }

  return { valido: true };
}

/**
 * Valida telefone fixo brasileiro
 * Aceita: (92) 3333-3333, 92 3333-3333, etc
 * @param valor - Valor a validar
 * @returns Objeto com validação e mensagem de erro
 */
export function validarTelefoneFixo(valor: string): { valido: boolean; erro?: string; formatado?: string } {
  if (!valor.trim()) {
    return { valido: true }; // Fixo é opcional
  }

  const apenasDigitos = valor.replace(/\D/g, '');
  const semPais = apenasDigitos.startsWith('55') ? apenasDigitos.slice(2) : apenasDigitos;

  // Deve ter 10 dígitos (DDD + 8 dígitos)
  if (semPais.length !== 10) {
    return {
      valido: false,
      erro: 'Telefone fixo deve ter 10 dígitos (DDD + 8 dígitos)',
    };
  }

  // Para fixo, o segundo dígito não deve ser 9
  if (semPais[0] === '9') {
    return {
      valido: false,
      erro: 'Parece ser um celular. Se é fixo, deve começar com 2-5',
    };
  }

  const ddd = semPais.substring(0, 2);
  const numero = semPais.substring(2);
  const formatado = `(${ddd}) ${numero.substring(0, 4)}-${numero.substring(4)}`;

  return { valido: true, formatado };
}

/**
 * Formata apenas o WhatsApp para um padrão legível
 * @param valor - WhatsApp a formatar
 * @returns String formatada ou valor original se inválido
 */
export function formatarWhatsApp(valor: string): string {
  const validacao = validarWhatsApp(valor);
  return validacao.formatado || valor;
}
