const { createClient } = require('@supabase/supabase-js');

// Use SERVICE ROLE to fix RLS policies
const supabase = createClient(
    'https://zfeftakhyawwdqvlmxno.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIzOTYxOSwiZXhwIjoyMDg2ODE1NjE5fQ.ePF9KY0j_-rMaiHUNY1s_D-TluR4p741YCST96O_kL8'
);

const sqlStatements = [
    // Allow authenticated users to read period_expenses
    `CREATE POLICY IF NOT EXISTS "Allow authenticated read period_expenses"
     ON period_expenses FOR SELECT
     TO authenticated
     USING (true)`,

    // Allow authenticated users to read special_quota_projects
    `CREATE POLICY IF NOT EXISTS "Allow authenticated read special_quota_projects"
     ON special_quota_projects FOR SELECT
     TO authenticated
     USING (true)`,

    // Allow authenticated users to read special_quota_payments
    `CREATE POLICY IF NOT EXISTS "Allow authenticated read special_quota_payments"
     ON special_quota_payments FOR SELECT
     TO authenticated
     USING (true)`,
];

async function fixRLS() {
    console.log('Fixing RLS policies...\n');

    for (const sql of sqlStatements) {
        const tableName = sql.match(/ON (\w+)/)?.[1];
        const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).catch(() => ({ error: { message: 'RPC not available' } }));

        if (error) {
            console.log(`⚠️  Could not apply policy via RPC for ${tableName} - will use manual SQL`);
        } else {
            console.log(`✅ Policy applied for ${tableName}`);
        }
    }

    // Alternative: show what needs to be done
    console.log('\n========== SQL a ejecutar en Supabase Dashboard ==========');
    console.log(`
-- Run this in the Supabase SQL Editor:

-- 1. Enable RLS read for period_expenses
DROP POLICY IF EXISTS "Allow authenticated read period_expenses" ON period_expenses;
CREATE POLICY "Allow authenticated read period_expenses"
  ON period_expenses FOR SELECT TO authenticated USING (true);

-- 2. Enable RLS read for special_quota_projects  
DROP POLICY IF EXISTS "Allow authenticated read special_quota_projects" ON special_quota_projects;
CREATE POLICY "Allow authenticated read special_quota_projects"
  ON special_quota_projects FOR SELECT TO authenticated USING (true);

-- 3. Enable RLS read for special_quota_payments
DROP POLICY IF EXISTS "Allow authenticated read special_quota_payments" ON special_quota_payments;
CREATE POLICY "Allow authenticated read special_quota_payments"
  ON special_quota_payments FOR SELECT TO authenticated USING (true);
`);
}

fixRLS().catch(console.error);
