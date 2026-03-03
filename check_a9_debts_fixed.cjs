const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    try {
        const { data: units, error: uError } = await supabase.from('units').select('number, initial_debt').eq('tower', 'A9');
        if (uError) console.error('uError:', uError);
        console.log('Units in tower A9:', units);
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

checkData();
