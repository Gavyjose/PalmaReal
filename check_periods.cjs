const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
    const { data: periods, error } = await supabase
        .from('condo_periods')
        .select('id, period_name, status, tower_id')
        .eq('tower_id', 'Torre A9')
        .order('created_at', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    console.log('Periods for Torre A9:');
    periods.forEach(p => {
        console.log(`- ${p.period_name} [${p.status}] (ID: ${p.id})`);
    });

    const { data: unit, error: uError } = await supabase
        .from('units')
        .select('id, number, initial_debt')
        .eq('number', 'PB-A')
        .single();

    if (uError) console.error(uError);
    else console.log('\nUnit PB-A:', unit);
}

check();
