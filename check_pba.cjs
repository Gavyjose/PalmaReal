const { createClient } = require('@supabase/supabase-clinet'); // wait I have a helper or can use run_command with curl
// Actually I'll use a cjs script with the supabase helper if available, or just run_command psql style via node-fetch or similar
// I'll use the existing supabase.js if I can, but I'm in terminal.
// Let's use a dynamic node script.
const { supabase } = require('./src/supabase');

async function checkData() {
    const { data: units, error: uError } = await supabase.from('units').select('id, number, initial_debt').eq('number', 'PB-A').single();
    console.log('Unit PB-A:', units, uError);

    const { data: periods, error: pError } = await supabase.from('condo_periods').select('id, period_name, status').order('created_at', { ascending: false });
    console.log('Periods:', periods);

    const { data: payments, error: payError } = await supabase.from('unit_payments').select('*').eq('unit_id', units?.id);
    console.log('Payments for PB-A:', payments);
}

checkData();
