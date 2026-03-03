const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    // Try a simple insert to see if the table exists
    const { data, error } = await supabase
        .from('special_quota_expenses')
        .select('id')
        .limit(1);

    if (error && error.code === 'PGRST204') {
        console.log('Table exists but is empty.');
    } else if (error) {
        console.log('Table status:', error.message);
        console.log('Code:', error.code);
    } else {
        console.log('Table exists! Rows:', data.length);
    }
}

run();
