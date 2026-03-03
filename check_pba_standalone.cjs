const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    try {
        const { data: unit, error: uError } = await supabase.from('units').select('id, number, initial_debt').eq('number', 'PB-A').single();
        console.log('Unit PB-A:', unit);
        if (uError) console.error('uError:', uError);

        const { data: periods, error: pError } = await supabase.from('condo_periods').select('id, period_name, status, tower_id').order('created_at', { ascending: false });
        console.log('Total Periods:', periods?.length);
        console.log('A9 Periods:', periods?.filter(p => p.tower_id?.includes('A9') || p.tower_id === '9' || p.tower_id === 'A9').map(p => p.period_name));

        const { data: payments, error: payError } = await supabase.from('unit_payments').select('*').eq('unit_id', unit?.id);
        console.log('Payments for PB-A:', payments?.length);
        if (payments && payments.length > 0) {
            console.log('Full Payment Details:', payments.map(p => ({ date: p.payment_date, bs: p.amount_bs, usd: p.amount_usd })));
        }

        const { data: allocations, error: allocError } = await supabase.from('unit_payment_allocations').select('*, unit_payments!inner(unit_id)').eq('unit_payments.unit_id', unit?.id);
        console.log('Allocations for PB-A:', allocations?.length);
        if (allocations) {
            console.log('Allocations amount total:', allocations.reduce((s, a) => s + parseFloat(a.amount_allocated), 0));
        }
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

checkData();
