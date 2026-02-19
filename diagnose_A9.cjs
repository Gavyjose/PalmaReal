const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function diagnose() {
    console.log('--- Buscando Torre A9 - FEBRERO 2026 ---');
    const { data: periods, error } = await supabase
        .from('condo_periods')
        .select('*, period_expenses(*)')
        .eq('tower_id', 'A9')
        .eq('period_name', 'FEBRERO 2026');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Encontrados ${periods.length} registros para este periodo.`);

    periods.forEach((p, idx) => {
        console.log(`\nREGISTRO #${idx + 1}`);
        console.log(`ID: ${p.id}`);
        console.log(`Status: ${p.status}`);
        console.log(`BCV: ${p.bcv_rate}`);
        console.log(`Fondo Reserva: ${p.reserve_fund}`);
        console.log(`Gastos asociados: ${p.period_expenses.length}`);
        p.period_expenses.forEach(e => {
            console.log(`  - ${e.description}: $${e.amount}`);
        });
    });
}

diagnose();
