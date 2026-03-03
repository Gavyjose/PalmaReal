
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkNullability() {
    console.log('--- TEST DE NULABILIDAD ---');
    // Si intentamos insertar un registro con montos nulos y falla, es que NO se aplicó el DROP NOT NULL
    const { error } = await supabase
        .from('unit_payments')
        .insert([{
            unit_id: 'c4de93b9-e89f-4fcc-bea8-6d7359365c7e',
            payment_date: '2026-02-19',
            amount_bs: null,
            amount_usd: 0,
            bcv_rate: null,
            reference: 'TEST_DELETE_ME'
        }]);

    if (error) {
        console.log('Error detectado (probablemente NOT NULL aún activo):', error.message);
    } else {
        console.log('¡Éxito! Los campos permiten nulos (pero la columna payment_method sigue faltando).');
        // Limpiar test
        await supabase.from('unit_payments').delete().eq('reference', 'TEST_DELETE_ME');
    }
}

checkNullability();
