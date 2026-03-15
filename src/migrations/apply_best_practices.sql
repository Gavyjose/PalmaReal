-- ============================================================================
-- SUPABASE POSTGRES BEST PRACTICES - Migration Script (CORREGIDO)
-- Aplicar: Ejecutar en SQL Editor de Supabase
-- ============================================================================

-- ============================================================================
-- 1. ÍNDICES CRÍTICOS (Query Performance - CRITICAL)
-- ============================================================================

-- Índices para unit_payments
CREATE INDEX IF NOT EXISTS idx_unit_payments_unit_id ON public.unit_payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_payments_payment_date ON public.unit_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_unit_payments_status ON public.unit_payments(status);

-- Índices para unit_payment_allocations
CREATE INDEX IF NOT EXISTS idx_unit_payment_allocations_payment_id ON public.unit_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_unit_payment_allocations_period_id ON public.unit_payment_allocations(period_id);

-- Índices para condo_periods
CREATE INDEX IF NOT EXISTS idx_condo_periods_tower_id ON public.condo_periods(tower_id);
CREATE INDEX IF NOT EXISTS idx_condo_periods_status ON public.condo_periods(status);
CREATE INDEX IF NOT EXISTS idx_condo_periods_period_name ON public.condo_periods(period_name);

-- Índices para period_expenses
CREATE INDEX IF NOT EXISTS idx_period_expenses_period_id ON public.period_expenses(period_id);
CREATE INDEX IF NOT EXISTS idx_period_expenses_payment_status ON public.period_expenses(payment_status);

-- Índices para units
CREATE INDEX IF NOT EXISTS idx_units_tower ON public.units(tower);
CREATE INDEX IF NOT EXISTS idx_units_owner_id ON public.units(owner_id);

-- Índices para owners
CREATE INDEX IF NOT EXISTS idx_owners_doc_id ON public.owners(doc_id);

-- Índices para bank_transactions
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reference ON public.bank_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON public.bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_matched_payment ON public.bank_transactions(matched_payment_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date_amount ON public.bank_transactions(transaction_date, amount);

-- Índices para special_quota_payments
CREATE INDEX IF NOT EXISTS idx_special_quota_payments_unit_id ON public.special_quota_payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_special_quota_payments_project_id ON public.special_quota_payments(project_id);

-- Índices para special_quota_projects
CREATE INDEX IF NOT EXISTS idx_special_quota_projects_tower_id ON public.special_quota_projects(tower_id);
CREATE INDEX IF NOT EXISTS idx_special_quota_projects_status ON public.special_quota_projects(status);

-- Índices para user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_owner_id ON public.user_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- ============================================================================
-- 2. FUNCIONES HELPER PARA RLS (Security - CRITICAL)
-- Nota: Roles válidos son MASTER, OPERADOR, VISOR
--       PROPIETARIO se determina por relación con units.owner_id
-- ============================================================================

-- Función para obtener el owner_id del usuario actual
CREATE OR REPLACE FUNCTION public.auth_user_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT owner_id FROM public.user_profiles WHERE id = (SELECT auth.uid())
  LIMIT 1
$$;

-- Función para verificar si el usuario es MASTER
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = (SELECT auth.uid()) 
    AND role = 'MASTER'
  )
$$;

-- Función para verificar si el usuario es OPERADOR o MASTER
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = (SELECT auth.uid()) 
    AND role IN ('MASTER', 'OPERADOR')
  )
$$;

-- Función para verificar si el usuario es VISOR
CREATE OR REPLACE FUNCTION public.is_viewer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = (SELECT auth.uid()) 
    AND role = 'VISOR'
  )
$$;

-- Función para verificar si el usuario es PROPIETARIO (tiene unidades asignadas)
CREATE OR REPLACE FUNCTION public.is_propietario()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.units 
    WHERE owner_id = (SELECT public.auth_user_owner_id())
  )
$$;

-- Función para obtener los IDs de unidades del propietario actual
CREATE OR REPLACE FUNCTION public.user_unit_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(id) FROM public.units WHERE owner_id = (SELECT public.auth_user_owner_id())
$$;

-- Función para obtener el tower_id del usuario (para ADMIN)
CREATE OR REPLACE FUNCTION public.user_tower_ids()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT tower) FROM public.units WHERE owner_id = (SELECT public.auth_user_owner_id())
$$;

-- ============================================================================
-- 3. POLÍTICAS RLS MEJORADAS (Security - CRITICAL)
-- ============================================================================

-- --- condo_periods ---
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en condo_periods" ON public.condo_periods;
DROP POLICY IF EXISTS "Admins can manage condo_periods" ON public.condo_periods;
DROP POLICY IF EXISTS "Owners can view published condo_periods" ON public.condo_periods;

CREATE POLICY "Admins can manage condo_periods"
ON public.condo_periods FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Owners can view published condo_periods"
ON public.condo_periods FOR SELECT
TO authenticated
USING (
  status = 'PUBLICADO' 
  AND (
    (SELECT public.is_admin())
    OR tower_id = ANY(public.user_tower_ids())
  )
);

-- --- period_expenses ---
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en period_expenses" ON public.period_expenses;
DROP POLICY IF EXISTS "Admins can manage period_expenses" ON public.period_expenses;

CREATE POLICY "Admins can manage period_expenses"
ON public.period_expenses FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- --- unit_payments ---
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en unit_payments" ON public.unit_payments;
DROP POLICY IF EXISTS "Admins can manage unit_payments" ON public.unit_payments;
DROP POLICY IF EXISTS "Owners can view own unit_payments" ON public.unit_payments;

CREATE POLICY "Admins can manage unit_payments"
ON public.unit_payments FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Owners can view own unit_payments"
ON public.unit_payments FOR SELECT
TO authenticated
USING (
  (SELECT public.is_admin())
  OR unit_id = ANY(public.user_unit_ids())
);

-- --- unit_payment_allocations ---
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en unit_payment_allocations" ON public.unit_payment_allocations;
DROP POLICY IF EXISTS "Admins can manage unit_payment_allocations" ON public.unit_payment_allocations;

CREATE POLICY "Admins can manage unit_payment_allocations"
ON public.unit_payment_allocations FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- --- units ---
DROP POLICY IF EXISTS "All users can view units" ON public.units;
DROP POLICY IF EXISTS "Admins can manage units" ON public.units;
DROP POLICY IF EXISTS "Owners can view own units" ON public.units;

CREATE POLICY "Admins can manage units"
ON public.units FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Owners can view own units"
ON public.units FOR SELECT
TO authenticated
USING (
  (SELECT public.is_admin())
  OR owner_id = (SELECT public.auth_user_owner_id())
);

-- --- owners ---
DROP POLICY IF EXISTS "Admins can manage owners" ON public.owners;
DROP POLICY IF EXISTS "Owners can view own profile" ON public.owners;

CREATE POLICY "Admins can manage owners"
ON public.owners FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Owners can view own profile"
ON public.owners FOR SELECT
TO authenticated
USING (
  (SELECT public.is_admin())
  OR id = (SELECT public.auth_user_owner_id())
);

-- --- bank_transactions ---
DROP POLICY IF EXISTS "All authenticated can view bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Admins can manage bank_transactions" ON public.bank_transactions;

CREATE POLICY "Admins can manage bank_transactions"
ON public.bank_transactions FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- --- special_quota_projects ---
DROP POLICY IF EXISTS "Admins can manage special_quota_projects" ON public.special_quota_projects;
DROP POLICY IF EXISTS "Owners can view active projects" ON public.special_quota_projects;

CREATE POLICY "Admins can manage special_quota_projects"
ON public.special_quota_projects FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Owners can view active projects"
ON public.special_quota_projects FOR SELECT
TO authenticated
USING (
  status = 'ACTIVE'
  AND (
    (SELECT public.is_admin())
    OR id IN (SELECT project_id FROM public.special_quota_payments WHERE unit_id = ANY(public.user_unit_ids()))
  )
);

-- --- special_quota_payments ---
DROP POLICY IF EXISTS "Owners can insert their own special payments" ON public.special_quota_payments;
DROP POLICY IF EXISTS "Admins can manage special_quota_payments" ON public.special_quota_payments;
DROP POLICY IF EXISTS "Owners can view own special_quota_payments" ON public.special_quota_payments;

CREATE POLICY "Admins can manage special_quota_payments"
ON public.special_quota_payments FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Owners can view own special_quota_payments"
ON public.special_quota_payments FOR SELECT
TO authenticated
USING (
  (SELECT public.is_admin())
  OR unit_id = ANY(public.user_unit_ids())
);

-- --- user_profiles ---
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Masters can do everything on profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR ALL
TO authenticated
USING (
  (SELECT public.is_admin())
  OR id = (SELECT auth.uid())
)
WITH CHECK (
  (SELECT public.is_admin())
  OR id = (SELECT auth.uid())
);

-- --- announcements ---
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;

CREATE POLICY "Admins can manage announcements"
ON public.announcements FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- --- towers ---
DROP POLICY IF EXISTS "All authenticated can view towers" ON public.towers;
DROP POLICY IF EXISTS "Admins can manage towers" ON public.towers;

CREATE POLICY "All authenticated can view towers"
ON public.towers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage towers"
ON public.towers FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

-- ============================================================================
-- 4. FUNCIÓN RPC PARA CONSULTAS COMPLEJAS (Optimización)
-- ============================================================================

-- Función para obtener el estado de cuenta de una unidad
CREATE OR REPLACE FUNCTION public.get_unit_account_statement(p_unit_id uuid)
RETURNS TABLE (
  period_name text,
  amount_due decimal,
  amount_paid decimal,
  balance decimal,
  payment_date date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.period_name,
    COALESCE(cp.unit_aliquot_usd, 0) AS amount_due,
    COALESCE(SUM(upa.amount_allocated), 0) AS amount_paid,
    COALESCE(cp.unit_aliquot_usd, 0) - COALESCE(SUM(upa.amount_allocated), 0) AS balance,
    MAX(up.payment_date) AS payment_date
  FROM public.condo_periods cp
  LEFT JOIN public.unit_payment_allocations upa ON upa.period_id = cp.id
  LEFT JOIN public.unit_payments up ON up.id = upa.payment_id AND up.status = 'COMPLETADO'
  WHERE cp.tower_id = p_unit_id
    AND cp.status = 'PUBLICADO'
  GROUP BY cp.id, cp.period_name, cp.unit_aliquot_usd
  ORDER BY cp.created_at DESC;
END;
$$;

-- Función para buscar transacciones bancarias por monto y fecha
CREATE OR REPLACE FUNCTION public.search_bank_transactions(
  p_amount_min decimal DEFAULT NULL,
  p_amount_max decimal DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_reference_pattern text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  transaction_date date,
  description text,
  amount decimal,
  reference text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id,
    bt.transaction_date,
    bt.description,
    bt.amount,
    bt.reference,
    bt.status
  FROM public.bank_transactions bt
  WHERE bt.status = 'PENDING'
    AND (p_amount_min IS NULL OR bt.amount >= p_amount_min)
    AND (p_amount_max IS NULL OR bt.amount <= p_amount_max)
    AND (p_date_from IS NULL OR bt.transaction_date >= p_date_from)
    AND (p_date_to IS NULL OR bt.transaction_date <= p_date_to)
    AND (p_reference_pattern IS NULL OR bt.reference ILIKE '%' || p_reference_pattern || '%')
  ORDER BY bt.transaction_date DESC
  LIMIT 100;
END;
$$;

-- ============================================================================
-- 5. NOTIFICAR RECARGA DE ESQUEMA
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 'Índices creados:' AS status, COUNT(*) AS total FROM pg_indexes WHERE schemaname = 'public';
SELECT 'Políticas RLS activas:' AS status, COUNT(*) AS total FROM pg_policies WHERE schemaname = 'public';
