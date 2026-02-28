import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listTables() {
    // We can't directly list tables via Supabase client easily without RPC or standard query
    // But we can try to query a few common ones or use an RPC if defined.
    // However, I can try to fetch from information_schema if I have permissions via SQL (not likely via anon key).

    // Instead, I'll check a list of potential tables I saw in .sql files.
    const tablesToCheck = [
        'condo_periods', 'period_expenses', 'units', 'owners', 'unit_payments',
        'unit_payment_allocations', 'special_quota_projects', 'special_quota_payments',
        'bcv_rates', 'exchange_rates', 'bank_transactions', 'tower_metrics'
    ];

    console.log("Checking tables...");
    for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
            console.log(`Table '${table}' exists.`);
        } else {
            // console.log(`Table '${table}' error: ${error.message}`);
        }
    }
}

listTables();
