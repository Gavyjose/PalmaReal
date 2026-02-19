-- Añadir columna de deuda inicial a las unidades
ALTER TABLE units ADD COLUMN IF NOT EXISTS initial_debt NUMERIC(15, 2) DEFAULT 0;

-- Comentario para documentación
COMMENT ON COLUMN units.initial_debt IS 'Deuda acumulada antes de la puesta en marcha del sistema (Pre-2026)';
