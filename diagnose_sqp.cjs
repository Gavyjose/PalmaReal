const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    try {
        const { data: units } = await supabase.from('units').select('id, number').eq('number', 'PB-A');
        const unitId = units[0]?.id;
        if (!unitId) throw new Error('Unit PB-A not found');

        const { data: sqp } = await supabase.from('special_quota_payments').select('*').eq('unit_id', unitId);
        const { data: ups } = await supabase.from('unit_payments').select('*').eq('unit_id', unitId);

        fs.writeFileSync('sqp_data.json', JSON.stringify({ unitId, sqp, ups }, null, 2));
        console.log('Data saved to sqp_data.json');
    } catch (e) {
        fs.writeFileSync('sqp_data.json', JSON.stringify({ error: e.message }));
    }
}
run();
