const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const sql = `
        ALTER TABLE special_quota_payments ADD COLUMN IF NOT EXISTS amount_bs NUMERIC;
        ALTER TABLE special_quota_payments ADD COLUMN IF NOT EXISTS bcv_rate NUMERIC;
        ALTER TABLE special_quota_payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
        ALTER TABLE special_quota_payments ADD COLUMN IF NOT EXISTS unit_payment_id UUID;
        GRANT ALL ON special_quota_payments TO anon, authenticated, service_role;
        NOTIFY pgrst, 'reload schema';
    `;

    try {
        console.log('Connecting to Supabase...');
        const { data, error } = await supabase.rpc('execute_sql_query', { query: sql });
        if (error) {
            console.error('SQL Execution Error:', error);
            fs.writeFileSync('fix_results.json', JSON.stringify({ success: false, sql_error: error }, null, 2));
            return;
        }

        console.log('SQL applied successfully. Waiting for schema reload (5s)...');
        await new Promise(r => setTimeout(r, 5000));

        console.log('Probing columns...');
        const { data: d1, error: e1 } = await supabase.from('special_quota_payments').select('*').limit(1);

        const results = {
            success: true,
            keys: d1 && d1.length > 0 ? Object.keys(d1[0]) : 'Empty Table, check schema',
            fetch_error: e1
        };

        if (results.keys === 'Empty Table, check schema') {
            const { data: cols } = await supabase.rpc('execute_sql_query', {
                query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'special_quota_payments'"
            });
            results.columns = cols?.map(c => c.column_name);
        }

        fs.writeFileSync('fix_results.json', JSON.stringify(results, null, 2));
        console.log('Execution finished. Check fix_results.json');
    } catch (e) {
        console.error('CRASH:', e);
        fs.writeFileSync('fix_results.json', JSON.stringify({ success: false, crash: e.message }, null, 2));
    }
}

run();
