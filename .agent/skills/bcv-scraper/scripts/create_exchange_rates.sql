-- ============================================================
-- BCV Scraper — Setup de Base de Datos en Supabase
-- Ejecuta en: Supabase → SQL Editor → Run
-- ============================================================

-- 1. Tabla para almacenar tasas de cambio
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_date DATE NOT NULL,
    rate_value DECIMAL(12,4) NOT NULL,
    provider TEXT DEFAULT 'BCV',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rate_date, provider)
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchange_rates_all" ON exchange_rates;
CREATE POLICY "exchange_rates_all"
ON exchange_rates FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(rate_date DESC);


-- 2. Función: obtener tasa para cualquier fecha
--    Si no hay tasa ese día (fin de semana/feriado), retorna la del último día hábil anterior
CREATE OR REPLACE FUNCTION get_bcv_rate(p_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
    SELECT rate_value
    FROM exchange_rates
    WHERE rate_date <= p_date
      AND provider = 'BCV'
    ORDER BY rate_date DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;


-- 3. Verificación
SELECT rate_date, rate_value, provider, created_at
FROM exchange_rates
ORDER BY rate_date DESC
LIMIT 10;
