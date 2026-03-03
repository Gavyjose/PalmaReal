const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    try {
        const projectId = 'c8b4f036-1e68-42eb-91d6-30156c89bcb9';
        console.log('Testing anon fetch for project:', projectId);

        const { data, error } = await supabase
            .from('special_quota_payments')
            .select('*')
            .eq('project_id', projectId);

        fs.writeFileSync('anon_test_results.json', JSON.stringify({ projectId, data, error }, null, 2));
        console.log('Done. Check anon_test_results.json');
    } catch (e) {
        fs.writeFileSync('anon_test_results.json', JSON.stringify({ exception: e.message }, null, 2));
    }
}
run();
