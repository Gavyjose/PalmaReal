const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    console.log("Testing units.initial_debt...");
    const { error: err1 } = await supabase.from('units').select('initial_debt').limit(1);
    console.log(err1 ? "FAIL: units.initial_debt missing" : "SUCCESS: units.initial_debt exists");

    console.log("Testing special_quota_payments.unit_payment_id...");
    const { error: err2 } = await supabase.from('special_quota_payments').select('unit_payment_id').limit(1);
    console.log(err2 ? "FAIL: special_quota_payments.unit_payment_id missing" : "SUCCESS: special_quota_payments.unit_payment_id exists");
}

test();
