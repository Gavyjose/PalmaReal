
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function findAnyPayment() {
    console.log('--- BUSCANDO TODOS LOS PAGOS RECIENTES ---');
    const { data: payments } = await supabase
        .from('unit_payments')
        .select(`
            *,
            units (
                number,
                tower
            )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

    if (payments) {
        payments.forEach(p => {
            console.log(`Pago ID: ${p.id}, Monto: $${p.amount_usd}, Unidad: ${p.units?.number} (${p.units?.tower}), Fecha: ${p.payment_date}`);
        });
    } else {
        console.log('No se encontraron pagos.');
    }
}

findAnyPayment();
