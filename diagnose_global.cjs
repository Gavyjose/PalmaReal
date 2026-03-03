const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

// Use SERVICE_ROLE_KEY to bypass RLS
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseAll() {
    console.log('--- DIAGNÓSTICO GLOBAL (BYPASS RLS) ---');

    const { data: payments, error: pError } = await supabase.from('unit_payments').select('*, units(number)').limit(10);
    if (pError) { console.log('Error payments:', pError); }
    console.log(`Total pagos (sample): ${payments?.length || 0}`);
    payments?.forEach(p => console.log(`- Unidad: ${p.units?.number}, USD: ${p.amount_usd}, Fecha: ${p.payment_date}`));

    const { data: allocations, error: aError } = await supabase.from('unit_payment_allocations').select('*').limit(10);
    if (aError) { console.log('Error allocations:', aError); }
    console.log(`\nTotal alocaciones (sample): ${allocations?.length || 0}`);

    const { data: special, error: sError } = await supabase.from('special_quota_payments').select('*, units(number)').limit(10);
    if (sError) { console.log('Error special:', sError); }
    console.log(`\nTotal pagos especiales (sample): ${special?.length || 0}`);
    special?.forEach(s => console.log(`- Unidad: ${s.units?.number}, USD: ${s.amount}, Ref: ${s.reference}`));
}

diagnoseAll();
