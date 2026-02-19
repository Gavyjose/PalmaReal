-- Añadir columna para rastrear el tipo de conciliación
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS match_type TEXT;

-- Comentario para documentación
COMMENT ON COLUMN bank_transactions.match_type IS 'Tipo de conciliación: REFERENCE o AMOUNT';
