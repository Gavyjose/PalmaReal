const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://zfeftakhyawwdqvlmxno.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8'
);

// We'll use the pg_policies system to check what's there first
async function checkAndFix() {
    // Check existing policies
    const { data: policies, error: pErr } = await supabase
        .from('pg_policies')
        .select('tablename, policyname, cmd, roles, qual')
        .in('tablename', ['period_expenses', 'special_quota_projects', 'special_quota_payments', 'condo_periods']);

    if (pErr) {
        console.log('Cannot read pg_policies directly:', pErr.message);
        console.log('\nFetching via information_schema...');

        // Try via information schema
        const { data: tables, error: tErr } = await supabase
            .rpc('get_table_policies', {})
            .catch(() => ({ data: null, error: { message: 'RPC not found' } }));

        console.log('RPC result:', tables, tErr?.message);
    } else {
        console.log('Existing RLS policies:');
        console.table(policies);
    }

    // Now let's try a different approach: use the admin API to execute SQL
    const SUPABASE_URL = 'https://zfeftakhyawwdqvlmxno.supabase.co';
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8';

    const sqlToExecute = `
        -- Fix RLS for period_expenses
        DROP POLICY IF EXISTS "Allow authenticated read period_expenses" ON period_expenses;
        CREATE POLICY "Allow authenticated read period_expenses"
          ON period_expenses FOR SELECT TO authenticated USING (true);

        -- Fix RLS for special_quota_projects  
        DROP POLICY IF EXISTS "Allow authenticated read special_quota_projects" ON special_quota_projects;
        CREATE POLICY "Allow authenticated read special_quota_projects"
          ON special_quota_projects FOR SELECT TO authenticated USING (true);

        -- Fix RLS for special_quota_payments
        DROP POLICY IF EXISTS "Allow authenticated read special_quota_payments" ON special_quota_payments;
        CREATE POLICY "Allow authenticated read special_quota_payments"
          ON special_quota_payments FOR SELECT TO authenticated USING (true);
    `;

    console.log('\nAttempting to apply RLS policies via REST API...');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql_text: sqlToExecute })
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', text.substring(0, 300));

    // Verify fix
    console.log('\n========== VERIFICANDO CON ANON KEY ==========');
    const anonClient = createClient(
        'https://zfeftakhyawwdqvlmxno.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
    );

    const { data: expenses, error: eErr } = await anonClient
        .from('period_expenses').select('id').limit(1);
    const { data: projects, error: prErr } = await anonClient
        .from('special_quota_projects').select('id').limit(1);

    console.log('period_expenses (anon):', expenses?.length > 0 ? '✅ ACCESSIBLE' : `❌ BLOCKED (${eErr?.message || 'empty'})`);
    console.log('special_quota_projects (anon):', projects?.length > 0 ? '✅ ACCESSIBLE' : `❌ BLOCKED (${prErr?.message || 'empty'})`);
}

checkAndFix().catch(console.error);
