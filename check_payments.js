import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'
const supabase = createClient(supabaseUrl, supabaseKey)

// 1. Get all columns from unit_payments (fetch one row with *)
console.log('=== unit_payments structure ===')
const { data: sample, error: sampleErr } = await supabase
    .from('unit_payments')
    .select('*')
    .limit(5)
    .order('created_at', { ascending: false })

if (sampleErr) {
    console.error('Error fetching unit_payments:', JSON.stringify(sampleErr))
} else {
    console.log(`Found ${sample.length} rows`)
    if (sample.length > 0) {
        console.log('Columns:', Object.keys(sample[0]).join(', '))
        sample.forEach(r => {
            console.log(JSON.stringify(r))
        })
    }
}

// 2. Check units table for tower info
console.log('\n=== units table (towers) ===')
const { data: units, error: unitsErr } = await supabase
    .from('units')
    .select('id, tower, number')
    .order('tower')
    .limit(10)

if (unitsErr) {
    console.error('Error:', JSON.stringify(unitsErr))
} else {
    units.forEach(u => console.log(`  id=${u.id} tower=${u.tower} number=${u.number}`))
}
