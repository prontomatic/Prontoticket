import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // En entornos de desarrollo puede que no existan aún, evitar crash al importar
  console.warn('Advertencia: Variables de entorno de Supabase ausentes.');
}

// Cliente con Service Role Key: Bypasea RLS por diseño (Acceso Backend Only)
export const supabase = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
);
