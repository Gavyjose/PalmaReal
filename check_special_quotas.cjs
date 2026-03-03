const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://zfeftakhyawwdqvlmxno.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8'
);

async function check() {
    console.log('\n========== CUOTAS ESPECIALES (PROYECTOS) ==========');
    const { data: projects, error: pErr } = await supabase
        .from('special_quota_projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (pErr) { console.error('Error proyectos:', pErr.message); }
    else if (!projects || projects.length === 0) {
        console.log('⚠️  No hay proyectos de cuotas especiales registrados');
    } else {
        console.table(projects.map(p => ({
            id: p.id.substring(0, 8) + '...',
            nombre: p.name,
            torre: p.tower_id,
            estado: p.status,
            presupuesto: p.total_budget,
            cuotas: p.installments_count,
            creado: p.created_at?.substring(0, 10)
        })));
    }

    console.log('\n========== PAGOS DE CUOTAS ESPECIALES ==========');
    const { data: payments, error: payErr } = await supabase
        .from('special_quota_payments')
        .select('*, unit:units(number, tower)');

    if (payErr) { console.error('Error pagos:', payErr.message); }
    else {
        console.log(`Total pagos registrados: ${payments?.length || 0}`);
        if (payments && payments.length > 0) console.table(payments.slice(0, 10));
    }

    console.log('\n========== TASA ACTUAL ==========');
    const { data: rate } = await supabase.rpc('get_bcv_rate', { p_date: '2026-02-22' });
    console.log('Tasa BCV hoy:', rate);
}

check().catch(console.error);
