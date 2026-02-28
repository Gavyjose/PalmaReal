-- Migración: Agregar campo de comisiones bancarias a condo_periods
-- Objetivo: Guardar el acumulado de comisiones bancarias por periodo

ALTER TABLE condo_periods 
ADD COLUMN IF NOT EXISTS bank_commissions_bs NUMERIC(15,2) DEFAULT 0;

-- Verificar que se aplicó correctamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'condo_periods' 
AND column_name = 'bank_commissions_bs';
