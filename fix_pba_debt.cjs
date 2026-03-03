const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixData() {
    try {
        // Fix PB-A: Set initial_debt to 20.63 (Historical December debt)
        const { data: uData, error: uError } = await supabase.from('units')
            .update({ initial_debt: 20.63 })
            .eq('number', 'PB-A')
            .select();

        if (uError) console.error('uError:', uError);
        console.log('Fixed PB-A Unit:', uData);

        // Also fix others if they are 0 and likely owe December?
        // Let's just fix PB-A for now to verify.
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

fixData();
