import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function debugPBA() {
    const unitNumber = 'PB-A';
    const { data: unit } = await supabase.from('units').select('*').eq('number', unitNumber).single();
    console.log(`--- DEBUG ${unitNumber} ---`);
    console.log(`Unit ID: ${unit.id}`);
    console.log(`Initial Debt: ${unit.initial_debt}`);

    const { data: periods } = await supabase.from('condo_periods').select('*, period_expenses(amount)').eq('tower_id', unit.tower);
    console.log(`\nPeriods for tower ${unit.tower}:`);
    periods.forEach(p => {
        const exp = (p.period_expenses || []).reduce((s, e) => s + parseFloat(e.amount), 0);
        const total = exp + parseFloat(p.reserve_fund || 0);
        const aliq = p.unit_aliquot_usd || (total / 16);
        console.log(`- ${p.period_name}: Expenses ${exp}, ResFund ${p.reserve_fund}, Aliquot ${aliq.toFixed(2)}`);
    });

    const { data: payments } = await supabase.from('unit_payments').select('*').eq('unit_id', unit.id).order('payment_date', { ascending: true });
    console.log(`\nPayments for ${unitNumber}:`);
    payments.forEach(p => {
        console.log(`- ${p.payment_date}: ${p.amount_usd} USD (${p.amount_bs} Bs)`);
    });

    const { data: specPays } = await supabase.from('special_quota_payments').select('*').eq('unit_id', unit.id);
    console.log(`\nSpecial Payments for ${unitNumber}:`);
    specPays.forEach(p => {
        console.log(`- ${p.amount} USD for Project ${p.project_id} (Installment ${p.installment_number})`);
    });
}

debugPBA();
