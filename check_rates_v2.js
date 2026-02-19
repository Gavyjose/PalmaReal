const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .gte('rate_date', '2026-01-01')
        .lte('rate_date', '2026-01-20')
        .order('rate_date', { ascending: true });

    if (error) {
        console.log("ERROR:", error);
    } else {
        console.log("DATA_START");
        data.forEach(r => {
            console.log(`${r.rate_date}|${r.rate_value}|${r.provider}`);
        });
        console.log("DATA_END");
    }
}

run();
