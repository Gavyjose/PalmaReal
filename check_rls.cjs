const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLSPolicies() {
    console.log('--- Checking RLS Policies ---');
    // Using postgres query to check policies
    const query = `
        select
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
        from pg_policies
        where schemaname = 'public'
    `;

    // Fallback if querying pg_policies from pure JS client fails (PostgREST doesn't expose pg_catalog)
    console.log("Attempting to read some table as the authenticated user");

    // Login as gavyjose
    const authClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);
    const { data: { session }, error: signInError } = await authClient.auth.signInWithPassword({
        email: 'gavyjose@gmail.com',
        password: 'Password1234!'
    });

    if (signInError) {
        console.error("Sign in failed:", signInError);
        return;
    }

    console.log("Signed in successfully. Fetching towers as user...");
    const { data: userTowers, error: fetchError } = await authClient.from('towers').select('*');
    if (fetchError) {
        console.error("Fetch Error:", fetchError);
    } else {
        console.log(`Towers seen by user: ${userTowers.length}`);
    }

    const { data: userUnits } = await authClient.from('units').select('*');
    console.log(`Units seen by user: ${userUnits ? userUnits.length : 0}`);
}

checkRLSPolicies();
