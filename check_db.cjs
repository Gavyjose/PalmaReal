const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkData() {
    console.log('--- Verificando periodos para Torre A9 ---');
    const { data, error } = await supabase
        .from('condo_periods')
        .select('*')
        .eq('tower_id', 'A9');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No se encontraron periodos para la Torre A9.');
    } else {
        data.forEach(p => {
            console.log(`ID: ${p.id} | Periodo: "${p.period_name}" | Status: ${p.status}`);
        });
    }

    console.log('\n--- Verificando todos los periodos con "Feb" ---');
    const { data: qData, error: qError } = await supabase
        .from('condo_periods')
        .select('*')
        .ilike('period_name', '%Feb%');

    if (qError) {
        console.error('Error:', qError);
        return;
    }

    qData.forEach(p => {
        console.log(`ID: ${p.id} | Torre: ${p.tower_id} | Periodo: "${p.period_name}"`);
    });
}

checkData();
