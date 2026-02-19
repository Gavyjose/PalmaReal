import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
    console.log("Fetching first record to see columns...");
    const { data, error } = await supabase.from('exchange_rates').select('*').limit(1);
    if (error) console.error(error);
    else console.log("Columns found:", Object.keys(data[0] || {}));
}

checkSchema();
