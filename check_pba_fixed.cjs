const { supabase } = require('./src/supabase');

async function checkData() {
    try {
        const { data: unit, error: uError } = await supabase.from('units').select('id, number, initial_debt').eq('number', 'PB-A').single();
        console.log('Unit PB-A:', unit);
        if (uError) console.error('uError:', uError);

        const { data: periods, error: pError } = await supabase.from('condo_periods').select('id, period_name, status, tower_id').order('created_at', { ascending: false });
        console.log('Total Periods:', periods?.length);
        console.log('Last 5 Periods:', periods?.slice(0, 5));

        const { data: payments, error: payError } = await supabase.from('unit_payments').select('*').eq('unit_id', unit?.id);
        console.log('Payments for PB-A:', payments?.length);
        if (payments && payments.length > 0) {
            console.log('Sample Payment:', payments[0]);
        }

        const { data: allocations, error: allocError } = await supabase.from('unit_payment_allocations').select('*, unit_payments!inner(unit_id)').eq('unit_payments.unit_id', unit?.id);
        console.log('Allocations for PB-A:', allocations?.length);
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

checkData();
