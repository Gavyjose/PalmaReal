import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
    console.log("Checking columns for 'condo_periods'...");
    const { data, error } = await supabase.from('condo_periods').select('*').limit(1);
    if (error) {
        console.error("Error fetching condo_periods:", error);
    } else {
        console.log("Columns in condo_periods:", Object.keys(data[0] || {}));
    }

    console.log("\nChecking columns for 'period_expenses'...");
    const { data: expData, error: expError } = await supabase.from('period_expenses').select('*').limit(1);
    if (expError) {
        console.error("Error fetching period_expenses:", expError);
    } else {
        console.log("Columns in period_expenses:", Object.keys(expData[0] || {}));
    }
}

checkColumns();
