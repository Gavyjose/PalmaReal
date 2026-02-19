-- Script para añadir campos de pago a period_expenses
ALTER TABLE period_expenses 
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS amount_bs DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS bcv_rate_at_payment DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS amount_usd_at_payment DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS bank_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDIENTE';

-- Actualizar registros existentes para tener estado PENDIENTE si es NULL
UPDATE period_expenses SET payment_status = 'PENDIENTE' WHERE payment_status IS NULL;

-- Notificar recarga de esquema
NOTIFY pgrst, 'reload schema';
