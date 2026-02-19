import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

const { data, error } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, amount, description, status')
    .order('transaction_date', { ascending: false })
    .limit(15)

if (error) {
    console.error('Error:', JSON.stringify(error))
} else {
    console.log(`Found ${data.length} records:`)
    data.forEach(r => {
        console.log(`  date=${r.transaction_date} | amount=${r.amount} | desc=${r.description?.substring(0, 30)}`)
    })
}
