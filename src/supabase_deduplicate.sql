-- 1. Limpiar duplicados en condo_periods manteniendo el más reciente
DELETE FROM condo_periods a
USING condo_periods b
WHERE a.created_at < b.created_at
  AND a.tower_id = b.tower_id
  AND a.period_name = b.period_name;

-- 2. Asegurar que no existan gastos huérfanos antes de poner la restricción (opcional pero seguro)
DELETE FROM period_expenses WHERE period_id NOT IN (SELECT id FROM condo_periods);

-- 3. Añadir restricción de unicidad para evitar futuros duplicados
ALTER TABLE condo_periods DROP CONSTRAINT IF EXISTS condo_periods_tower_id_period_name_key;
ALTER TABLE condo_periods ADD CONSTRAINT condo_periods_tower_id_period_name_key UNIQUE (tower_id, period_name);

-- 4. Notificar recarga
NOTIFY pgrst, 'reload schema';
