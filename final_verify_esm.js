import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    console.log("--- FINAL SCHEMA TEST ---");

    // Test units
    const { error: err1 } = await supabase.from('units').select('initial_debt').limit(1);
    const uOk = !err1 || err1.code !== '42703';
    console.log(uOk ? "✅ units.initial_debt: OK" : "❌ units.initial_debt: MISSING");

    // Test special_quota_payments
    const { error: err2 } = await supabase.from('special_quota_payments').select('unit_payment_id').limit(1);
    const sqOk = !err2 || err2.code !== '42703';
    console.log(sqOk ? "✅ special_quota_payments.unit_payment_id: OK" : "❌ special_quota_payments.unit_payment_id: MISSING");

    if (err1 && err1.code !== '42703') console.log("Note units error (other than missing column):", err1.message);
    if (err2 && err2.code !== '42703') console.log("Note special_quota_payments error (other than missing column):", err2.message);
}

test();
