const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
    // Get the unit ID from the URL in the screenshot
    const unitId = '7da908b7-1ee7-4946-a359-1a39d8dc35b2';

    console.log('=== UNIT DATA ===');
    const { data: unit } = await supabase
        .from('units')
        .select('id, number, tower, initial_debt')
        .eq('id', unitId)
        .single();
    console.log(JSON.stringify(unit, null, 2));

    console.log('\n=== UNIT PAYMENTS (all for this unit) ===');
    const { data: payments } = await supabase
        .from('unit_payments')
        .select('*')
        .eq('unit_id', unitId)
        .order('payment_date', { ascending: false });
    payments?.forEach(p => {
        console.log(`  ${p.payment_date} | $${p.amount_usd} | Bs ${p.amount_bs} | Ref: ${p.reference} | Method: ${p.payment_method} | ID: ${p.id}`);
    });

    console.log('\n=== PAYMENT ALLOCATIONS (condo periods) ===');
    const { data: allocations } = await supabase
        .from('unit_payment_allocations')
        .select('*, unit_payments!inner(unit_id, payment_date, reference)')
        .eq('unit_payments.unit_id', unitId);
    allocations?.forEach(a => {
        console.log(`  Period: ${a.period_id} | Allocated: $${a.amount_allocated} | Payment: ${a.unit_payments?.payment_date} | Ref: ${a.unit_payments?.reference}`);
    });

    console.log('\n=== SPECIAL QUOTA PAYMENTS (for this unit) ===');
    const { data: specialPay } = await supabase
        .from('special_quota_payments')
        .select('*')
        .eq('unit_id', unitId);
    specialPay?.forEach(sp => {
        console.log(`  Project: ${sp.project_id} | Installment: ${sp.installment_number} | $${sp.amount} | Ref: ${sp.reference} | Date: ${sp.payment_date} | Parent: ${sp.unit_payment_id}`);
    });
}

diagnose();
