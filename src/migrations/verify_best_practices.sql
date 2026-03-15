-- ============================================================================
-- VERIFICACIÓN POST-APLICACIÓN
-- Ejecutar CADA CONSULTA por separado en SQL Editor
-- ============================================================================

-- ============================================
-- 1. Verificar índices creados
-- ============================================
SELECT 
  'unit_payments' AS table_name,
  COUNT(*) AS index_count
FROM pg_indexes 
WHERE tablename = 'unit_payments' AND schemaname = 'public'
UNION ALL
SELECT 
  'condo_periods',
  COUNT(*) 
FROM pg_indexes 
WHERE tablename = 'condo_periods' AND schemaname = 'public'
UNION ALL
SELECT 
  'bank_transactions',
  COUNT(*) 
FROM pg_indexes 
WHERE tablename = 'bank_transactions' AND schemaname = 'public'
UNION ALL
SELECT 
  'units',
  COUNT(*) 
FROM pg_indexes 
WHERE tablename = 'units' AND schemaname = 'public';

-- ============================================
-- 2. Verificar funciones RLS creadas
-- ============================================
SELECT proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE proname IN (
  'auth_user_owner_id', 'is_master', 'is_admin', 
  'is_propietario', 'user_unit_ids', 'user_tower_ids',
  'get_unit_account_statement', 'search_bank_transactions'
) AND nspname = 'public';

-- ============================================
-- 3. Verificar políticas RLS seguras (no USING(true))
-- ============================================
SELECT 
  policyname,
  tablename,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND (qual IS NULL OR qual::text NOT LIKE '%true%')
ORDER BY tablename;

-- ============================================
-- 4. Verificar políticas permisivas (USING(true)) - DEBERÍA ESTAR VACÍO
-- ============================================
SELECT policyname, tablename, cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND (qual::text = 'true' OR qual IS NULL);

-- ============================================
-- 5. Resumen total
-- ============================================
SELECT 
  'Total índices' AS metric, COUNT(*)::text AS value FROM pg_indexes WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Total políticas RLS', COUNT(*)::text FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Total funciones', COUNT(*)::text FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE nspname = 'public';
