import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkJanRates() {
    console.log("Checking rates for Jan 2026...");
    const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .gte('rate_date', '2026-01-01')
        .lte('rate_date', '2026-01-20')
        .order('rate_date', { ascending: true });

    if (error) {
        console.error("Error:", error);
    } else {
        console.table(data.map(r => ({
            date: r.rate_date,
            value: r.rate_value,
            provider: r.provider
        })));
    }
}

checkJanRates();
