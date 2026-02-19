import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function verifyColumn() {
    console.log("Checking units table columns...");
    const { data, error } = await supabase.from('units').select('*').limit(1);
    if (error) {
        console.error("Error fetching units:", error);
    } else {
        const columns = Object.keys(data[0] || {});
        console.log("Found columns:", columns);
        if (columns.includes('initial_debt')) {
            console.log("Column 'initial_debt' exists.");
        } else {
            console.log("Column 'initial_debt' is MISSING.");
        }
    }
}

verifyColumn();
