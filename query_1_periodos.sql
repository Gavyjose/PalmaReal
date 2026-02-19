-- CONSULTA 1: Ver todos los periodos registrados
SELECT 
    tower_id,
    period_name,
    status,
    reserve_fund,
    bcv_rate,
    created_at
FROM condo_periods
ORDER BY created_at DESC;
