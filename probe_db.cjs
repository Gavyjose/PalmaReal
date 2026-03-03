const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    try {
        const { data: d1, error: e1 } = await supabase.from('special_quota_payments').select('*').limit(1);
        const { data: d2, error: e2 } = await supabase.from('unit_payments').select('*').limit(1);

        const results = {
            sqp: d1 ? Object.keys(d1[0] || {}) : null,
            sqp_error: e1,
            up: d2 ? Object.keys(d2[0] || {}) : null,
            up_error: e2
        };

        fs.writeFileSync('probe_results.json', JSON.stringify(results, null, 2));
    } catch (e) {
        fs.writeFileSync('probe_results.json', JSON.stringify({ exception: e.message }));
    }
}
run();
