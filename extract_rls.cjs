const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    try {
        const { data: q1 } = await supabase.rpc('execute_sql_query', {
            query: "SELECT * FROM pg_policies WHERE tablename IN ('special_quota_payments', 'unit_payments')"
        });

        fs.writeFileSync('rls_results.json', JSON.stringify(q1, null, 2));
    } catch (e) {
        fs.writeFileSync('rls_results.json', JSON.stringify({ error: e.message }, null, 2));
    }
}
run();
