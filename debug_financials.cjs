
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugData() {
    console.log('--- BUSCANDO TODOS LOS PERIODOS ---');
    const { data: periods } = await supabase.from('condo_periods').select('*');
    periods.forEach(p => console.log(`ID: ${p.id}, Name: ${p.period_name}, Tower: "${p.tower_id}"`));

    console.log('\n--- BUSCANDO TODOS LOS GASTOS ---');
    const { data: expenses } = await supabase.from('period_expenses').select('*');
    console.log(`Total gastos encontrados: ${expenses.length}`);
    if (expenses.length > 0) {
        console.log('Muestra de gastos:', expenses.slice(0, 5));
    }

    console.log('\n--- BUSCANDO PROYECTOS CUOTA ESPECIAL ---');
    const { data: projects } = await supabase.from('special_quota_projects').select('*');
    projects.forEach(p => console.log(`ID: ${p.id}, Name: ${p.name}, Tower: "${p.tower_id}"`));

    console.log('\n--- BUSCANDO PAGOS PARA PB-A (7da908b7...) ---');
    const { data: payments } = await supabase.from('unit_payments').select('*').eq('unit_id', '7da908b7-1ee7-4946-a359-1a39d8dc35b2');
    console.log(`Total pagos para la unidad: ${payments.length}`);
    payments.forEach(p => console.log(`Pago ID: ${p.id}, Fecha: ${p.payment_date}, Monto: $${p.amount_usd}`));
}

debugData();
