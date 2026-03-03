const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: unit } = await supabase.from('units').select('id').eq('number', 'PB-A').single();
    if (!unit) {
        console.log('Unit PB-A not found');
        return;
    }

    console.log('--- SPECIAL QUOTA PAYMENTS FOR PB-A ---');
    const { data: sqp } = await supabase.from('special_quota_payments')
        .select('id, amount, amount_bs, bcv_rate, reference, payment_date, unit_payment_id')
        .eq('unit_id', unit.id);

    sqp.forEach(p => {
        console.log(`ID: ${p.id} | Ref: ${p.reference} | Date: ${p.payment_date} | USD: ${p.amount} | Bs: ${p.amount_bs} | Rate: ${p.bcv_rate} | UP_ID: ${p.unit_payment_id}`);
    });

    console.log('\n--- UNIT PAYMENTS (Matching by ID or Ref) ---');
    const refs = sqp.map(p => p.reference).filter(Boolean);
    const { data: up } = await supabase.from('unit_payments')
        .select('id, amount_bs, bcv_rate, amount_usd, reference, payment_date')
        .in('reference', refs);

    if (up) {
        up.forEach(p => {
            console.log(`ID: ${p.id} | Ref: ${p.reference} | Date: ${p.payment_date} | USD: ${p.amount_usd} | Bs: ${p.amount_bs} | Rate: ${p.bcv_rate}`);
        });
    }
}
run();
