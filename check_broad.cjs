const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    try {
        const { data: units, error: uError } = await supabase.from('units').select('id, number, tower_id, initial_debt').eq('number', 'PB-A');
        console.log('Units with number PB-A:', units);

        const { data: periods, error: pError } = await supabase.from('condo_periods').select('*').order('period_name', { ascending: false });
        console.log('Unique Period Names:', [...new Set(periods?.map(p => p.period_name))]);

        const dicPeriods = periods?.filter(p => p.period_name === 'DICIEMBRE 2025');
        console.log('DICIEMBRE 2025 Periods:', dicPeriods?.map(p => ({ tower: p.tower_id, id: p.id })));

        // Let's check the expense calculation for Diciembre 2025 for tower A9 if it exists
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

checkData();
