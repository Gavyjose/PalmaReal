import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: unit } = await supabase.from('units').select('id, number').eq('number', 'PB-A').single();
    if (!unit) return fs.writeFileSync('db_verify.json', JSON.stringify({ error: 'PB-A not found' }));

    const { data: payments } = await supabase.from('special_quota_payments').select('*').eq('unit_id', unit.id);
    fs.writeFileSync('db_verify.json', JSON.stringify({ unit, payments }, null, 2));
}
run();
