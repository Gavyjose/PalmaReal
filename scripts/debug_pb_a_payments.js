import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkPB_A_Context() {
    console.log("Checking status for 'PB-A'...");
    const { data: unitData } = await supabase.from('units').select('*').eq('number', 'PB-A').single();
    console.log("Unit Data:", unitData);

    console.log("Checking payments for 'PB-A'...");
    const { data: payments } = await supabase.from('payments').select('*').eq('unit_id', unitData.id);
    console.log("Payments:", payments);

    console.log("Checking expenses for 'PB-A'...");
    // Maybe checking expenses / billing?
}

checkPB_A_Context();
