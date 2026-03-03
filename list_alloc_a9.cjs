const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listAllocA9() {
    console.log('--- ALOCACIONES TODOS TORRE A9 ---');

    // Get unit IDs for A9
    const { data: units } = await supabase.from('units').select('id').eq('tower', 'A9');
    const unitIds = units?.map(u => u.id) || [];

    if (unitIds.length === 0) { console.log('No units in A9'); return; }

    // Get payments for these units
    const { data: payments } = await supabase
        .from('unit_payments')
        .select('*, units(number)')
        .in('unit_id', unitIds);

    console.log(`Total pagos encontrados en A9: ${payments?.length || 0}`);
    payments?.forEach(p => console.log(`- Pago ID: ${p.id}, Unidad: ${p.units?.number}, USD: ${p.amount_usd}, Ref: ${p.reference}`));

    // Get allocations for these payments
    const payIds = payments?.map(p => p.id) || [];
    if (payIds.length > 0) {
        const { data: allocations } = await supabase
            .from('unit_payment_allocations')
            .select('*, condo_periods(period_name)')
            .in('payment_id', payIds);

        console.log(`\nTotal alocaciones mantenimiento en A9: ${allocations?.length || 0}`);
        allocations?.forEach(a => console.log(`- Alocación USD: ${a.amount_allocated}, Periodo: ${a.condo_periods?.period_name}`));
    }
}

listAllocA9();
