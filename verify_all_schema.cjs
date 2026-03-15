
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyAllSchema() {
    console.log('--- VERIFICANDO unit_payments.receipt_url ---');
    const { error: error1 } = await supabase
        .from('unit_payments')
        .select('receipt_url')
        .limit(1);
    
    if (error1) {
        console.log('❌ unit_payments.receipt_url NO existe:', error1.message);
    } else {
        console.log('✅ unit_payments.receipt_url EXISTE.');
    }

    console.log('--- VERIFICANDO special_quota_payments.receipt_url ---');
    const { error: error2 } = await supabase
        .from('special_quota_payments')
        .select('receipt_url')
        .limit(1);
    
    if (error2) {
        console.log('❌ special_quota_payments.receipt_url NO existe:', error2.message);
    } else {
        console.log('✅ special_quota_payments.receipt_url EXISTE.');
    }
}

verifyAllSchema();
