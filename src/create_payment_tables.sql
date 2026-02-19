-- Tabla para registrar pagos de condominio (cabezal)
CREATE TABLE IF NOT EXISTS unit_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id) NOT NULL,
    payment_date DATE NOT NULL,
    amount_bs DECIMAL(12,2) NOT NULL,
    amount_usd DECIMAL(12,2) NOT NULL,
    bcv_rate DECIMAL(12,2) NOT NULL,
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabla para detallar qué periodos cubre el pago
CREATE TABLE IF NOT EXISTS unit_payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES unit_payments(id) ON DELETE CASCADE,
    period_id UUID REFERENCES condo_periods(id) NOT NULL,
    amount_allocated DECIMAL(12,2) NOT NULL, -- Parte del pago asignada a este periodo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE unit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_payment_allocations ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (ajustar luego para producción)
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en unit_payments" ON unit_payments;
CREATE POLICY "Permitir todo a usuarios autenticados en unit_payments" 
ON unit_payments FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en unit_payment_allocations" ON unit_payment_allocations;
CREATE POLICY "Permitir todo a usuarios autenticados en unit_payment_allocations" 
ON unit_payment_allocations FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
