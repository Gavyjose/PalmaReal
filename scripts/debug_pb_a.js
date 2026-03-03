import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkPB_A() {
    console.log("Checking status for 'PB-A'...");
    const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('number', 'PB-A');

    if (error) {
        console.error("Error fetching units:", error);
    } else {
        console.log("Data for PB-A:", data);
    }
}

checkPB_A();
