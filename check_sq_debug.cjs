const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://zfeftakhyawwdqvlmxno.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8'
);

async function check() {
    // 1. Check units for A9 with inner join (same as SpecialQuotas.jsx)
    console.log('\n========== UNITS A9 (inner join - mismo query que SpecialQuotas) ==========');
    const { data: unitsInner, error: innerErr } = await supabase
        .from('units')
        .select(`id, number, floor, tower, owners!inner (full_name)`)
        .eq('tower', 'A9');

    if (innerErr) {
        console.error('ERROR con inner join:', innerErr.message);
    } else {
        console.log(`Unidades con propietario (inner join): ${unitsInner?.length}`);
        console.table(unitsInner?.map(u => ({ num: u.number, propietario: u.owners?.full_name })));
    }

    // 2. Check all units for A9 (without inner join)
    console.log('\n========== UNITS A9 (left join - sin filtro de propietario) ==========');
    const { data: unitsAll } = await supabase
        .from('units')
        .select(`id, number, floor, tower, owner_id, owners(full_name)`)
        .eq('tower', 'A9');

    console.log(`Total unidades en A9: ${unitsAll?.length}`);
    const sinPropietario = unitsAll?.filter(u => !u.owner_id) || [];
    console.log(`Sin propietario asignado: ${sinPropietario.length}`);
    if (sinPropietario.length > 0) {
        console.log('Unidades sin propietario:', sinPropietario.map(u => u.number));
    }

    // 3. Simulate the exact project query
    console.log('\n========== SIMULANDO QUERY DE PROYECTO ==========');
    const { data: projData, error: projErr } = await supabase
        .from('special_quota_projects')
        .select('*')
        .eq('tower_id', 'A9')
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();

    console.log('Proyecto encontrado:', projData?.name || 'NINGUNO', '| Error:', projErr?.message || 'ninguno');
}

check().catch(console.error);
