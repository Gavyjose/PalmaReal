-- Tabla para el Control de Gastos en Cuotas Especiales
-- Los gastos se registran en Bs y se convierten a USD según la tasa BCV del día de compra
CREATE TABLE IF NOT EXISTS public.special_quota_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.special_quota_projects(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT CHECK (category IN ('MATERIALES', 'MANO DE OBRA', 'OTROS')),
    amount_bs NUMERIC(15, 2) NOT NULL DEFAULT 0,
    bcv_rate NUMERIC(15, 4) NOT NULL DEFAULT 0,
    amount_usd NUMERIC(15, 2) NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.special_quota_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'special_quota_expenses' AND policyname = 'Allow all for anon'
    ) THEN
        CREATE POLICY "Allow all for anon" ON public.special_quota_expenses
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
