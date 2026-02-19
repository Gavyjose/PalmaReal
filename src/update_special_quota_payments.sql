-- Añadir columna de vinculación en special_quota_payments
ALTER TABLE special_quota_payments 
ADD COLUMN IF NOT EXISTS unit_payment_id UUID REFERENCES unit_payments(id) ON DELETE SET NULL;
