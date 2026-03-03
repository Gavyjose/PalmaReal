
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
    console.log('--- VERIFICANDO COLUMNAS DE unit_payments ---');
    // Intentamos hacer un select de una columna que sabemos que existe y capturamos el error si intentamos payment_method
    const { data, error } = await supabase
        .from('unit_payments')
        .select('payment_method')
        .limit(1);

    if (error) {
        console.log('Error detectado:', error.message);
        console.log('Código de error:', error.code);
    } else {
        console.log('¡La columna existe! Datos encontrados:', data);
    }

    // Listar todas las columnas visibles via RPC si fuera posible, 
    // pero como no tenemos RPC configurado, intentamos un truco con un insert fallido o select *
    const { data: allData, error: allErrors } = await supabase
        .from('unit_payments')
        .select('*')
        .limit(1);

    if (allData && allData.length > 0) {
        console.log('Columnas encontradas en el primer registro:', Object.keys(allData[0]));
    } else {
        console.log('No se pudieron recuperar registros para ver las columnas.');
    }
}

checkColumns();
