import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Faltan las variables de entorno de Supabase. Asegúrate de configurar .env correctamente.');
}

// Solución definitiva: pasar fn() directamente como lock.
// Esto evita el AbortError del API Web Locks del navegador sin serializar ninguna petición.
// Supabase tiene su propio sistema interno de deduplicación de refresh de tokens.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        lock: (_name, _acquireTimeout, fn) => fn()
    }
});
