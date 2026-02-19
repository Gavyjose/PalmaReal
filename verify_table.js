
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function verify() {
    const { data, error } = await supabase
        .from('bank_transactions')
        .select('count', { count: 'exact', head: true })

    if (error) {
        console.log('Error:', error.message)
        if (error.code === '42P01') console.log('Table does not exist')
    } else {
        console.log('Table exists')
    }
}

verify()
