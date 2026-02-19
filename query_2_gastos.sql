-- CONSULTA 2: Ver gastos por periodo
SELECT 
    cp.tower_id,
    cp.period_name,
    cp.status,
    pe.description,
    pe.amount,
    pe.payment_status
FROM period_expenses pe
JOIN condo_periods cp ON pe.period_id = cp.id
ORDER BY cp.created_at DESC, pe.description;
