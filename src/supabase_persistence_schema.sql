-- Tabla para los periodos de condominio por torre
CREATE TABLE IF NOT EXISTS condo_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tower_id TEXT NOT NULL, -- Ej: 'A1', 'A2'
    period_name TEXT NOT NULL, -- Ej: 'FEBRERO 2026'
    reserve_fund DECIMAL(12,2) DEFAULT 0,
    bcv_rate DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'BORRADOR', -- 'BORRADOR' o 'PUBLICADO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(tower_id, period_name)
);

-- Tabla para el desglose de gastos de cada periodo
CREATE TABLE IF NOT EXISTS period_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id UUID REFERENCES condo_periods(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE condo_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas temporales para permitir acceso total (Ajustar en producción)
CREATE POLICY "Permitir todo a usuarios autenticados en condo_periods" 
ON condo_periods FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Permitir todo a usuarios autenticados en period_expenses" 
ON period_expenses FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
