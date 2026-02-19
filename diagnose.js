// Diagnóstico de period_expenses para ver gastos pagados
const SUPABASE_URL = 'https://zfeftakhyawwdqvlmxno.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZ0YWtoeWF3d2RxdmxteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2MTksImV4cCI6MjA4NjgxNTYxOX0.i1BGWC53FZbo4eb-C29SWrlx3cKIqXANpeq0WBEJDNw'

async function query(table, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`
    const res = await fetch(url, { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } })
    return { status: res.status, data: await res.json() }
}

async function main() {
    // 1. Ver estructura de period_expenses (primeras 3 filas)
    console.log('=== period_expenses (muestra) ===')
    const r1 = await query('period_expenses', 'select=*&limit=3')
    console.log(`Status: ${r1.status}`)
    if (r1.status === 200 && r1.data.length > 0) {
        console.log('Columnas:', Object.keys(r1.data[0]).join(', '))
        r1.data.forEach(r => console.log(JSON.stringify(r)))
    } else {
        console.log('Sin datos o error:', JSON.stringify(r1.data))
    }

    // 2. Ver gastos con payment_status = PAGADO
    console.log('\n=== Gastos PAGADOS en period_expenses ===')
    const r2 = await query('period_expenses', 'select=id,expense_name,amount_usd,amount_bs,payment_date,bank_reference,payment_status,period_id&payment_status=eq.PAGADO&limit=10')
    console.log(`Status: ${r2.status}, Registros: ${Array.isArray(r2.data) ? r2.data.length : 'error'}`)
    if (Array.isArray(r2.data)) {
        r2.data.forEach(r => console.log(`  name=${r.expense_name} bs=${r.amount_bs} date=${r.payment_date} ref=${r.bank_reference} status=${r.payment_status}`))
    }

    // 3. Ver todos los estados distintos
    console.log('\n=== Todos los registros de period_expenses ===')
    const r3 = await query('period_expenses', 'select=id,expense_name,amount_usd,amount_bs,payment_date,bank_reference,payment_status,period_id&limit=20')
    console.log(`Status: ${r3.status}, Registros: ${Array.isArray(r3.data) ? r3.data.length : 'error'}`)
    if (Array.isArray(r3.data)) {
        r3.data.forEach(r => console.log(`  name=${r.expense_name} usd=${r.amount_usd} bs=${r.amount_bs} date=${r.payment_date} ref=${r.bank_reference} status=${r.payment_status}`))
    }
}

main().catch(console.error)
