/**
 * Proteção de origem para ações disparadas pelo frontend.
 *
 * O Supabase JS autentica as chamadas com o header Authorization (Bearer),
 * não com cookies enviados automaticamente pelo navegador. A checagem de
 * frame evita ações induzidas por clickjacking; a autenticação continua sendo
 * validada pelas policies/RLS no Supabase.
 */
export function validarOrigemDaAcao(): string | null {
  if (typeof window === 'undefined') return null;

  if (window.self !== window.top) {
    return 'Por segurança, esta ação não pode ser executada dentro de outro site.';
  }

  return null;
}
