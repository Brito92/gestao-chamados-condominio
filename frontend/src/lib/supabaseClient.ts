import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falha alto e cedo: sem essas variáveis nenhuma tela funciona.
  // eslint-disable-next-line no-console
  console.error(
    'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. ' +
      'Copie frontend/.env.example para frontend/.env e preencha com os dados do seu projeto Supabase.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

/** Nome do bucket de Storage usado para todos os anexos de chamados. */
export const BUCKET_ANEXOS = 'chamados-anexos';
