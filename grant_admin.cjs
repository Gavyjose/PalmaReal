const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdminStatus() {
    const emailToFind = 'gavyjose@gmail.com';
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    const targetUser = users.find(u => u.email === emailToFind);

    console.log('--- Attempting to find profile for user ---');
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', targetUser.id).single();
    if (profile) {
        console.log('Profile found:', profile);
        if (profile.role !== 'admin') {
            console.log('Updating role to admin...');
            const { error: updateError } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', targetUser.id);
            if (updateError) console.error("Update Error:", updateError);
            else console.log("Profile updated to admin.");
        }
    } else {
        console.log('No profile found. Attempting to create one as admin...');
        const { error: insertError } = await supabase.from('profiles').insert({
            id: targetUser.id,
            role: 'admin',
            email: emailToFind,
        });
        if (insertError) {
            console.log('Insert Profile Error. Profiles schema might differ:', insertError);

            // Try user_roles if profiles fails
            console.log('Trying user_roles table...');
            const { error: roleError } = await supabase.from('user_roles').insert({
                user_id: targetUser.id,
                role: 'admin'
            });
            if (roleError) console.error("User Roles Error:", roleError);
            else console.log("Inserted into user_roles.");
        } else {
            console.log("Profile created successfully as admin.");
        }
    }
}

checkAdminStatus();
