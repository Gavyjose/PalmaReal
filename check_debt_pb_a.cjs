
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDetailedDebt() {
    const tower = 'A9';
    const unitNumber = 'PB-A';

    // 1. Unidad
    const { data: unit } = await supabase
        .from('units')
        .select('*')
        .eq('number', unitNumber)
        .eq('tower', tower)
        .single();

    console.log('--- UNIDAD ---');
    console.log(unit);

    // 2. Periodos
    const { data: periods } = await supabase
        .from('condo_periods')
        .select('*, period_expenses(*)')
        .eq('tower_id', tower)
        .eq('status', 'PUBLICADO');

    console.log('\n--- PERIODOS ---');
    periods.forEach(p => {
        const expensesSum = p.period_expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const total = expensesSum + parseFloat(p.reserve_fund || 0);
        const aliquot = total / 16;
        console.log(`${p.period_name}: Expenses=$${expensesSum.toFixed(2)}, Reserve=$${p.reserve_fund}, Total=$${total.toFixed(2)}, Aliquot=$${aliquot.toFixed(2)}`);
    });

    // 3. Cuotas Especiales
    const { data: projects } = await supabase
        .from('special_quota_projects')
        .select('*')
        .eq('tower_id', tower);

    console.log('\n--- PROYECTOS CUOTA ESPECIAL ---');
    projects.forEach(proj => {
        const perUnitTotal = proj.total_budget / 16;
        const perInstallment = perUnitTotal / proj.installments_count;
        console.log(`${proj.name}: Total=$${proj.total_budget}, PerUnit=$${perUnitTotal.toFixed(2)}, Installments=${proj.installments_count}, PerInstallment=$${perInstallment.toFixed(2)}`);
    });

    // 4. Pagos Normales
    const { data: normalPayments } = await supabase
        .from('unit_payments')
        .select('*, unit_payment_allocations(*)')
        .eq('unit_id', unit.id);

    console.log('\n--- PAGOS NORMALES Y ASIGNACIONES ---');
    normalPayments.forEach(pay => {
        console.log(`Pago: Date=${pay.payment_date}, Amount=$${pay.amount_usd}`);
        pay.unit_payment_allocations.forEach(alloc => {
            const pName = periods.find(p => p.id === alloc.period_id)?.period_name || 'Desconocido';
            console.log(`  - Asignado a ${pName}: $${alloc.amount_allocated}`);
        });
    });

    // 5. Pagos Especiales
    const { data: specialPayments } = await supabase
        .from('special_quota_payments')
        .select('*')
        .eq('unit_id', unit.id);

    console.log('\n--- PAGOS CUOTAS ESPECIALES ---');
    specialPayments.forEach(sp => {
        const projName = projects.find(p => p.id === sp.project_id)?.name || 'Desconocido';
        console.log(`  - Proy: ${projName}, Cuota: ${sp.installment_number}, Monto: $${sp.amount_usd}`);
    });
}

checkDetailedDebt();
