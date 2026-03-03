const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listA9() {
    console.log('--- UNIDADES TORRE A9 ---');
    const { data: units } = await supabase
        .from('units')
        .select('*, owners(full_name)')
        .eq('tower', 'A9');

    units?.forEach(u => console.log(`- ${u.number}: ${u.owners?.full_name} (ID: ${u.id})`));
}

listA9();
