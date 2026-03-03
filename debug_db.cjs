
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugDatabase() {
    console.log('--- TEST DE CONEXION ---');
    const { data: units, error: unitsError } = await supabase.from('units').select('id, number, tower').limit(5);
    if (unitsError) {
        console.error('Error al leer units:', unitsError);
    } else {
        console.log('Unidades encontradas:', units);
    }

    console.log('\n--- VERIFICANDO CONTEXTO DE TABLA unit_payments ---');
    const { data: pTest, error: pError } = await supabase.from('unit_payments').select('*', { count: 'exact', head: true });
    if (pError) {
        console.error('Error al contar pagos:', pError);
    } else {
        console.log('Conteo total de pagos (según RLS):', pTest);
    }
}

debugDatabase();
