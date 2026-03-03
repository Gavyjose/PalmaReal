const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function diagnosePBA() {
    console.log('--- DIAGNÓSTICO UNIDAD PB-A ---');

    // 1. Get unit ID
    const { data: unit } = await supabase.from('units').select('*').eq('number', 'PB-A').single();
    if (!unit) { console.log('Unit not found'); return; }
    console.log(`Unit: ${unit.number} (ID: ${unit.id})`);

    // 2. Get payments for this unit in January 2026
    const { data: payments } = await supabase
        .from('unit_payments')
        .select('*')
        .eq('unit_id', unit.id)
        .gte('payment_date', '2026-01-01')
        .lte('payment_date', '2026-01-31');

    console.log('\nPagos en Enero 2026:');
    payments?.forEach(p => console.log(`- Pago ID: ${p.id}, Monto USD: ${p.amount_usd}, Ref: ${p.reference}`));

    // 3. Get condo allocations
    const paymentIds = payments?.map(p => p.id) || [];
    if (paymentIds.length > 0) {
        const { data: allocations } = await supabase
            .from('unit_payment_allocations')
            .select('*, condo_periods(period_name)')
            .in('payment_id', paymentIds);

        console.log('\nAlocaciones a CONDOMINIO (Mantenimiento):');
        allocations?.forEach(a => console.log(`- Alocación USD: ${a.amount_allocated} al periodo ${a.condo_periods?.period_name}`));
    } else {
        console.log('\nNo allocations to condo found.');
    }

    // 4. Get special project payments
    const { data: specialPayments } = await supabase
        .from('special_quota_payments')
        .select('*, special_quota_projects(name)')
        .eq('unit_id', unit.id)
        .gte('payment_date', '2026-01-01')
        .lte('payment_date', '2026-01-31');

    console.log('\nPagos a PROYECTOS ESPECIALES:');
    specialPayments?.forEach(s => console.log(`- Pago USD: ${s.amount} al proyecto ${s.special_quota_projects?.name}`));
}

diagnosePBA();
