const { createClient } = require('@supabase/supabase-js');

// Test with ANON key (same as browser uses)
const supabaseAnon = createClient(
    'https://zfeftakhyawwdqvlmxno.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
);

async function check() {
    console.log('\n========== TEST CON ANON KEY (como el navegador) ==========');

    // 1. Test condo_periods with anon key
    const { data: periods, error: pErr } = await supabaseAnon
        .from('condo_periods')
        .select('*')
        .eq('tower_id', 'A9');

    if (pErr) {
        console.error('❌ Error RLS en condo_periods:', pErr.message, '| Code:', pErr.code);
    } else {
        console.log(`✅ condo_periods accesible: ${periods?.length} registros`);
        if (periods?.length > 0) {
            const enero = periods.find(p => p.period_name === 'ENERO 2026');
            console.log('Período ENERO encontrado:', enero ? 'SÍ' : 'NO');

            if (enero) {
                const { data: expenses, error: eErr } = await supabaseAnon
                    .from('period_expenses')
                    .select('*')
                    .eq('period_id', enero.id);

                if (eErr) console.error('❌ Error RLS en period_expenses:', eErr.message);
                else console.log(`✅ period_expenses de ENERO: ${expenses?.length} registros`);
            }
        }
    }

    // 2. Test special_quota_projects with anon key
    console.log('\n--- Cuotas Especiales ---');
    const { data: projects, error: sqErr } = await supabaseAnon
        .from('special_quota_projects')
        .select('*')
        .eq('tower_id', 'A9')
        .eq('status', 'ACTIVE');

    if (sqErr) {
        console.error('❌ Error RLS en special_quota_projects:', sqErr.message);
    } else {
        console.log(`✅ special_quota_projects accesible: ${projects?.length} proyectos`);
        projects?.forEach(p => console.log(`  → ${p.name} [${p.status}]`));
    }

    console.log('\n========== FIN DEL TEST ==========');
}

check().catch(console.error);
