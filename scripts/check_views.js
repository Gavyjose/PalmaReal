import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkViewsAndRPCs() {
    console.log("Checking for views and RPCs...");
    // We can't easily list views via anon key without a custom RPC.
    // But we can check if some common view names exist.
    const potentialViews = [
        'unit_metrics', 'consolidated_cobranzas', 'period_summaries',
        'financial_ledger_view', 'afecciones_financieras_view'
    ];

    for (const view of potentialViews) {
        const { error } = await supabase.from(view).select('*').limit(1);
        if (!error) {
            console.log(`View '${view}' exists.`);
        }
    }
}

checkViewsAndRPCs();
