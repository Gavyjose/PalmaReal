const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    let output = '';
    try {
        const { data: unit } = await supabase.from('units').select('id').eq('number', 'PB-A').single();
        output += `Unit PB-A ID: ${unit?.id}\n`;

        const { data: rows, error } = await supabase.from('special_quota_payments').select('*').eq('unit_id', unit.id);
        if (error) {
            output += `Error selecting from SQP: ${error.message}\n`;
        } else {
            output += `Found ${rows.length} rows for PB-A\n`;
            rows.forEach(r => {
                output += `Ref: ${r.reference} | Bs: ${r.amount_bs} | USD: ${r.amount} | Date: ${r.payment_date}\n`;
            });
        }
    } catch (e) {
        output += `Error: ${e.message}\n`;
    }
    fs.writeFileSync('debug_output.txt', output);
    console.log('Done');
}
run();
