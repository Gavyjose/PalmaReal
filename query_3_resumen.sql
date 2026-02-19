-- CONSULTA 3: Resumen de gastos por periodo
SELECT 
    cp.tower_id,
    cp.period_name,
    cp.status,
    COUNT(pe.id) as num_gastos,
    SUM(pe.amount) as total_gastos
FROM condo_periods cp
LEFT JOIN period_expenses pe ON pe.period_id = cp.id
GROUP BY cp.id, cp.tower_id, cp.period_name, cp.status
ORDER BY cp.created_at DESC;
