
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSqpColumns() {
    console.log('--- VERIFICANDO COLUMNAS DE special_quota_payments ---');
    const { data, error } = await supabase
        .from('special_quota_payments')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error.message);
    } else if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log('Columnas encontradas:', columns);
        if (columns.includes('receipt_url')) {
            console.log('✅ El campo receipt_url EXISTE.');
        } else {
            console.log('❌ El campo receipt_url NO existe.');
        }
    } else {
        console.log('No hay registros en special_quota_payments para verificar columnas mediante select *');
        // Intento directo
        const { error: colError } = await supabase
            .from('special_quota_payments')
            .select('receipt_url')
            .limit(1);
        
        if (colError) {
            console.log('❌ El campo receipt_url NO existe o no es accesible:', colError.message);
        } else {
            console.log('✅ El campo receipt_url EXISTE (verificado mediante select directo).');
        }
    }
}

checkSqpColumns();
