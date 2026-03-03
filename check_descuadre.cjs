
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDescuadre() {
    const unitId = '7da908b7-1ee7-4946-a359-1a39d8dc35b2';

    // 1. Ver todos los pagos de esta unidad
    const { data: payments } = await supabase
        .from('unit_payments')
        .select('*, unit_payment_allocations(*)')
        .eq('unit_id', unitId);

    console.log('--- PAGOS Y ASIGNACIONES ---');
    payments.forEach(p => {
        const totalAllocated = p.unit_payment_allocations.reduce((sum, a) => sum + parseFloat(a.amount_allocated), 0);
        console.log(`Pago ID: ${p.id}`);
        console.log(`  Monto Real USD: $${p.amount_usd}`);
        console.log(`  Monto Asignado Total: $${totalAllocated.toFixed(2)}`);
        console.log(`  Diferencia: $${(p.amount_usd - totalAllocated).toFixed(2)}`);

        if (Math.abs(p.amount_usd - totalAllocated) > 0.01) {
            console.log('  ⚠️ ¡DESCUADRE DETECTADO!');
        }
    });

    // 2. Ver cuotas especiales por si acaso
    const { data: sPayments } = await supabase
        .from('special_quota_payments')
        .select('*')
        .eq('unit_id', unitId);

    console.log('\n--- CUOTAS ESPECIALES (PROYECTOS) ---');
    sPayments.forEach(sp => {
        console.log(`Proyect ID: ${sp.project_id}, Cuota: ${sp.installment_number}, Monto: $${sp.amount}`);
    });
}

checkDescuadre();
