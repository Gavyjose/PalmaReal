const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    try {
        const { data: periods, error: pError } = await supabase.from('condo_periods').select('*');
        console.log('All Periods:', periods?.map(p => ({ n: p.period_name, t: p.tower_id, s: p.status })));

        const { data: unit, error: uError } = await supabase.from('units').select('*').eq('number', 'PB-A').single();
        console.log('Unit PB-A details:', unit);
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

checkData();
