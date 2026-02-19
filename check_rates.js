import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRates() {
    console.log("Fetching recent exchange rates...");
    const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('rate_date', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error:", error);
    } else {
        console.table(data.map(r => ({
            date: r.rate_date,
            value: r.rate_value,
            provider: r.provider,
            source: r.metadata?.source || 'N/A'
        })));
    }
}

checkRates();
