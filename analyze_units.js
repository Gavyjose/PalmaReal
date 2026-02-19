
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

async function analyzeUnits() {
    const { data, error } = await supabase
        .from('units')
        .select('*')
        .limit(10)

    if (error) {
        console.log('Error:', error.message)
    } else {
        console.log('Units Sample:', data)
        // Check distinct towers if column exists
        const { data: towers } = await supabase
            .from('units')
            .select('tower')

        if (towers) {
            const uniqueTowers = [...new Set(towers.map(u => u.tower))];
            console.log('Unique Towers:', uniqueTowers);
        }
    }
}

analyzeUnits()
