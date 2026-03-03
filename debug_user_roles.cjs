const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserData() {
    const emailToFind = 'gavyjose@gmail.com';
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.error('Error fetching users:', userError);
        return;
    }

    const targetUser = users.find(u => u.email === emailToFind);

    if (!targetUser) {
        console.log('User not found!');
        return;
    }

    console.log('User ID:', targetUser.id);
    console.log('User metadata:', targetUser.user_metadata);

    // Check if there is a profile or role mapping table
    console.log('\n--- Checking common role/profile tables ---');

    // Check if user is linked to a tower/condo
    const tablesToCheck = ['users', 'profiles', 'roles', 'user_roles'];

    for (const tableName of tablesToCheck) {
        try {
            const { data, error } = await supabase.from(tableName).select('*').eq('id', targetUser.id).limit(1);
            if (!error && data && data.length > 0) {
                console.log(`Found data in table ${tableName}:`, data[0]);
            }
        } catch (e) {
            // Ignore if table doesn't exist
        }
    }

    // Try to see what projects / towers exist
    console.log('\n--- Checking what towers/condos exist ---');
    const { data: towers } = await supabase.from('condominiums').select('*').limit(5);
    if (towers) {
        console.log('Available Condominiums (Towers):', towers);
    } else {
        const { data: towers2 } = await supabase.from('towers').select('*').limit(5);
        console.log('Available Towers:', towers2);
    }
}

checkUserData();
