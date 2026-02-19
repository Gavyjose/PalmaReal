import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkPeriods() {
    console.log("Fetching periods...");
    const { data, error } = await supabase.from('condo_periods').select('period_name, created_at, tower_id').order('created_at', { ascending: false });
    if (error) console.error(error);
    else console.log("Recent periods:", data);
}

checkPeriods();
