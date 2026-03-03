const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    try {
        const { data: q1 } = await supabase.rpc('get_table_columns', { p_table_name: 'special_quota_payments' });
        // If get_table_columns doesn't exist, try execute_sql_query
        let info = {};
        if (q1) {
            info.sqp = q1;
        } else {
            const { data: q1_alt } = await supabase.rpc('execute_sql_query', {
                query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'special_quota_payments'"
            });
            info.sqp = q1_alt;
        }

        const { data: q2 } = await supabase.rpc('execute_sql_query', {
            query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'unit_payments'"
        });
        info.up = q2;

        fs.writeFileSync('schema_info.json', JSON.stringify(info, null, 2));
    } catch (e) {
        fs.writeFileSync('error.txt', e.toString());
    }
}
run();
