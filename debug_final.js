import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    let log = '';
    try {
        const { data: rows, error } = await supabase
            .from('special_quota_payments')
            .select('id, amount, amount_bs, reference, unit_id')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            log += `DB ERROR: ${error.message}\n`;
        } else {
            log += `ROWS FOUND: ${rows.length}\n`;
            rows.forEach(r => {
                log += `ID: ${r.id} | Ref: ${r.reference} | USD: ${r.amount} | Bs: ${r.amount_bs}\n`;
            });
        }
    } catch (e) {
        log += `CATCH ERROR: ${e.message}\n`;
    }
    fs.writeFileSync('final_debug.txt', log);
    console.log('Finished');
}

run();
