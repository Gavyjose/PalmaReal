import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function verifyColumn() {
    console.log("Checking special_quota_payments table columns...");
    // Intentamos seleccionar una fila para ver las columnas en el objeto devuelto
    const { data, error } = await supabase.from('special_quota_payments').select('*').limit(1);

    if (error) {
        console.error("Error fetching special_quota_payments:", error);
    } else {
        const columns = Object.keys(data[0] || {});
        console.log("Found columns:", columns);
        if (columns.includes('unit_payment_id')) {
            console.log("Column 'unit_payment_id' exists.");
        } else {
            console.log("Column 'unit_payment_id' is MISSING.");
        }
    }
}

verifyColumn();
