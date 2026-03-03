const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function fixPayment() {
    const unitId = '7da908b7-1ee7-4946-a359-1a39d8dc35b2';
    const paymentId = 'db8ba5ec-a73b-4707-a457-113428e2a753'; // The 13/1/2026 $42.86 payment
    const projectId = 'c8b4f036-1e68-42eb-91d6-30156c89bcb9';

    // 1. Delete the incorrect CUOTA 2 special payment
    console.log('1. Deleting incorrect CUOTA 2 special payment...');
    const { error: delErr } = await supabase
        .from('special_quota_payments')
        .delete()
        .eq('unit_id', unitId)
        .eq('project_id', projectId)
        .eq('installment_number', 2);

    if (delErr) {
        console.error('Error deleting:', delErr);
        return;
    }
    console.log('   ✅ CUOTA 2 special payment deleted.');

    // 2. Find the ENERO 2026 period ID
    console.log('\n2. Finding ENERO 2026 period...');
    const { data: periods } = await supabase
        .from('condo_periods')
        .select('id, period_name')
        .eq('tower_id', 'A9')
        .eq('status', 'PUBLICADO');

    const enero = periods?.find(p => p.period_name.toUpperCase().includes('ENERO'));
    if (!enero) {
        console.error('ENERO 2026 period not found!');
        console.log('Available periods:', periods?.map(p => p.period_name).join(', '));
        return;
    }
    console.log(`   Found: ${enero.period_name} (ID: ${enero.id})`);

    // 3. Calculate the correct allocation amounts
    // Total payment: $42.86
    // The initial_debt was already cleared, so we need to figure out how much went to HISTORY
    // Let's check what the original initial_debt was
    // Since initial_debt is now 0 and $42.86 was the total, 
    // the ENERO portion should be the aliquot for that period

    // Calculate ENERO aliquot
    const { data: periodoEnero } = await supabase
        .from('condo_periods')
        .select('id, period_name, reserve_fund, period_expenses(amount)')
        .eq('id', enero.id)
        .single();

    const totalExpenses = periodoEnero.period_expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
    const aliquot = parseFloat(((totalExpenses + parseFloat(periodoEnero.reserve_fund || 0)) / 16).toFixed(2));
    console.log(`   ENERO aliquot: $${aliquot}`);

    // 4. Create the correct allocation for ENERO
    console.log('\n3. Creating ENERO allocation...');
    const { error: allocErr } = await supabase
        .from('unit_payment_allocations')
        .insert([{
            payment_id: paymentId,
            period_id: enero.id,
            amount_allocated: aliquot
        }]);

    if (allocErr) {
        console.error('Error creating allocation:', allocErr);
        return;
    }
    console.log(`   ✅ Allocated $${aliquot} to ENERO 2026.`);

    // 5. Verify final state
    console.log('\n=== VERIFICATION ===');
    const { data: finalAlloc } = await supabase
        .from('unit_payment_allocations')
        .select('*, unit_payments!inner(unit_id)')
        .eq('unit_payments.unit_id', unitId);
    console.log('Allocations:', finalAlloc?.length || 0);
    finalAlloc?.forEach(a => console.log(`  Period: ${a.period_id} -> $${a.amount_allocated}`));

    const { data: finalSpecial } = await supabase
        .from('special_quota_payments')
        .select('*')
        .eq('unit_id', unitId);
    console.log('\nSpecial payments:', finalSpecial?.length || 0);
    finalSpecial?.forEach(sp => console.log(`  Installment ${sp.installment_number}: $${sp.amount}`));
}

fixPayment();
