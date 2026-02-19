-- Tabla de Proyectos de Cuotas Especiales
CREATE TABLE IF NOT EXISTS special_quota_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    total_budget NUMERIC DEFAULT 0,
    installments_count INTEGER DEFAULT 1,
    tower_id TEXT, -- Puede ser para una torre o general (ej: 'A1', 'A9')
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Pagos de Cuotas Especiales
CREATE TABLE IF NOT EXISTS special_quota_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES special_quota_projects(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id),
    installment_number INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    reference TEXT,
    payment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE special_quota_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_quota_payments ENABLE ROW LEVEL SECURITY;

-- Políticas (Permitir todo para usuarios autenticados)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all special_quota_projects') THEN
        CREATE POLICY "Allow all special_quota_projects" ON special_quota_projects FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all special_quota_payments') THEN
        CREATE POLICY "Allow all special_quota_payments" ON special_quota_payments FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;
