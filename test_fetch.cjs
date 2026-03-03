const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLSPoliciesOnUnits() {
    console.log("Fetching RLS details for units & special_quota_projects...");

    // Can only query pg_policies with raw SQL if extensions are installed
    // Let's create an RPC or just try to see if policies are enabled

    // Try a simple direct read as service role (ignores RLS)
    const { data: adminUnits } = await supabase.from('units').select('id').limit(1);
    console.log(`Bypassing RLS (Service Role) - found units: ${adminUnits ? adminUnits.length : 0}`);

    // Let's emulate the new user again but specifically for SpecialQuotas fetch logic
    const authClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);
    const { data: { session }, error: signInError } = await authClient.auth.signInWithPassword({
        email: 'gavyjose@gmail.com',
        password: 'Password1234!'
    });

    if (signInError) {
        console.error("Sign in failed:", signInError.message);
        return;
    }

    // Try the exact query from SpecialQuotas
    const { data: unitsData, error: uError } = await authClient
        .from('units')
        .select(`id, number, floor, tower, owners!inner (full_name)`)
        .eq('tower', 'A9');

    console.log(`Units fetched by gavyjose@gmail.com for Tower A9:`, unitsData ? unitsData.length : uError);

    // Try fetching projects
    const { data: projData, error: pError } = await authClient
        .from('special_quota_projects')
        .select('*');

    console.log(`Projects fetched by gavyjose@gmail.com:`, projData ? projData.length : pError);

}

checkRLSPoliciesOnUnits();
