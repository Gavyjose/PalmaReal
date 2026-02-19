-- Script de Diagnóstico para Reportes
-- Ejecuta esto en el SQL Editor de Supabase para ver qué datos existen

-- 1. Ver todos los periodos registrados
SELECT 
    tower_id,
    period_name,
    status,
    reserve_fund,
    bcv_rate,
    created_at
FROM condo_periods
ORDER BY created_at DESC;

-- 2. Ver gastos por periodo
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

-- 3. Resumen de gastos por periodo
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

-- 4. Ver unidades (verificar nombre de columna)
SELECT id, tower, owner_id
FROM units
LIMIT 5;
