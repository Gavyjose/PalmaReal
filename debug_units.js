import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUnitsSchema() {
    console.log("Fetching sample unit...");
    const { data, error } = await supabase.from('units').select('*').limit(1);
    if (error) console.error(error);
    else console.log("Units columns:", Object.keys(data[0] || {}));
}

checkUnitsSchema();
