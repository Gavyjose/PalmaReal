-- ============================================================
-- DIAGNÓSTICO Y CORRECCIÓN COMPLETA DE unit_payments
-- Ejecuta este script en Supabase SQL Editor
-- ============================================================

-- 1. Verificar si la tabla unit_payments existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'unit_payments'
) AS tabla_existe;

-- 2. Ver columnas actuales de unit_payments
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'unit_payments'
ORDER BY ordinal_position;

-- 3. Ver políticas RLS actuales
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('unit_payments', 'unit_payment_allocations', 'bank_transactions')
ORDER BY tablename;

-- 4. Ver cuántos registros hay (bypass RLS con service role)
SELECT COUNT(*) AS total_pagos FROM unit_payments;

-- ============================================================
-- CORRECCIÓN: Agregar columna status si no existe
-- ============================================================
ALTER TABLE unit_payments 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

ALTER TABLE bank_transactions
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- Recrear políticas RLS permisivas
-- unit_payments: permitir todo a usuarios autenticados
ALTER TABLE unit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en unit_payments" ON unit_payments;
DROP POLICY IF EXISTS "unit_payments_all" ON unit_payments;

CREATE POLICY "unit_payments_all"
ON unit_payments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- unit_payment_allocations
ALTER TABLE unit_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en unit_payment_allocations" ON unit_payment_allocations;
DROP POLICY IF EXISTS "unit_payment_allocations_all" ON unit_payment_allocations;

CREATE POLICY "unit_payment_allocations_all"
ON unit_payment_allocations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- bank_transactions
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_transactions_all" ON bank_transactions;

CREATE POLICY "bank_transactions_all"
ON bank_transactions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- VERIFICAR: Insertar un pago de prueba para confirmar que funciona
-- (Reemplaza el unit_id con un ID real de tu tabla units)
-- ============================================================

-- Primero ver los unit_ids disponibles:
SELECT id, tower, number FROM units ORDER BY tower, number LIMIT 10;

-- Luego insertar pago de prueba (descomenta y ajusta el unit_id):
/*
INSERT INTO unit_payments (unit_id, payment_date, amount_bs, amount_usd, bcv_rate, reference)
VALUES (
    'REEMPLAZA_CON_UN_UNIT_ID_REAL',
    '2026-02-18',
    5000.00,
    125.00,
    40.00,
    'TEST-001'
);
SELECT * FROM unit_payments ORDER BY created_at DESC LIMIT 5;
*/

-- ============================================================
-- VERIFICAR FINAL
-- ============================================================
SELECT 
    up.id,
    up.payment_date,
    up.amount_bs,
    up.amount_usd,
    up.bcv_rate,
    up.reference,
    up.status,
    u.tower,
    u.number
FROM unit_payments up
JOIN units u ON u.id = up.unit_id
ORDER BY up.created_at DESC
LIMIT 20;
