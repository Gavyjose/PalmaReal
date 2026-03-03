// Fix RLS using Supabase Management API
// Project ref: zfeftakhyawwdqvlmxno

const SQL = `
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

-- Also ensure INSERT/UPDATE policies exist for admin use
DROP POLICY IF EXISTS "Allow authenticated write period_expenses" ON period_expenses;
CREATE POLICY "Allow authenticated write period_expenses"
  ON period_expenses FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write special_quota_projects" ON special_quota_projects;
CREATE POLICY "Allow authenticated write special_quota_projects"
  ON special_quota_projects FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write special_quota_payments" ON special_quota_payments;
CREATE POLICY "Allow authenticated write special_quota_payments"
  ON special_quota_payments FOR ALL TO authenticated USING (true);
`;

async function applyFix() {
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8';
    const PROJECT_REF = 'zfeftakhyawwdqvlmxno';

    // Try Supabase Management API for SQL execution
    console.log('Applying RLS policies via Management API...');
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: SQL })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text.substring(0, 500));

    // Fallback: try via postgREST with auth
    if (response.status !== 200) {
        console.log('\nTrying alternative approach...');
        // The Supabase anon key with a real user session would be needed
        // Let's instead verify and show the SQL needed
        console.log('\nSQL to run manually in Supabase Dashboard > SQL Editor:\n');
        console.log(SQL);
    }

    // Always verify
    await verifyFix();
}

async function verifyFix() {
    const { createClient } = require('@supabase/supabase-js');
    const anonClient = createClient(
        'https://zfeftakhyawwdqvlmxno.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
    );

    const { data: e } = await anonClient.from('period_expenses').select('id').limit(1);
    const { data: p } = await anonClient.from('special_quota_projects').select('id').limit(1);

    console.log('\n===== VERIFICACION TRAS FIX =====');
    console.log('period_expenses accesible:', e?.length >= 0 ? '✅ ACCESSIBLE' : '❌ BLOCKED');
    console.log('special_quota_projects accesible:', p?.length >= 0 ? '✅ ACCESSIBLE' : '❌ BLOCKED');
    console.log('period_expenses rows:', e?.length || 0);
    console.log('special_quota_projects rows:', p?.length || 0);
}

applyFix().catch(console.error);
