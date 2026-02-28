import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUnitsColumns() {
    console.log("Checking columns for 'units'...");
    const { data, error } = await supabase.from('units').select('*').limit(1);
    if (error) {
        console.error("Error fetching units:", error);
    } else {
        console.log("Columns in units:", Object.keys(data[0] || {}));
    }
}

checkUnitsColumns();
