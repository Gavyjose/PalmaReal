-- 1. Eliminar duplicados en condo_periods
-- Nos quedamos con el registro más reciente (el de mayor fecha de creación o ID)
DELETE FROM condo_periods a
USING condo_periods b
WHERE a.id < b.id
  AND a.tower_id = b.tower_id
  AND a.period_name = b.period_name;

-- 2. Estandarizar nombres de periodos y estados a MAYÚSCULAS
UPDATE condo_periods 
SET 
  period_name = UPPER(period_name),
  status = UPPER(status);

UPDATE period_expenses
SET
  description = UPPER(description);

-- 3. Añadir restricción UNIQUE para evitar duplicados futuros
-- Si ya existe un índice único, SQL no hará nada. Si no, lo creará.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_tower_period'
    ) THEN
        ALTER TABLE condo_periods ADD CONSTRAINT unique_tower_period UNIQUE (tower_id, period_name);
    END IF;
END $$;

-- 4. Notificar recarga de caché
NOTIFY pgrst, 'reload schema';
