-- Script de Reparación DEFINITIVO 2.0 para Alícuotas
-- Ejecuta esto en el SQL Editor de Supabase y dale a "Run"

-- 1. Limpieza de columnas obsoletas que causan errores
DO $$ 
BEGIN 
    -- Eliminar columnas de esquemas antiguos que tienen NOT NULL y bloquean el guardado
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='month') THEN
        ALTER TABLE condo_periods DROP COLUMN month;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='year') THEN
        ALTER TABLE condo_periods DROP COLUMN year;
    END IF;
END $$;

-- 2. Asegurar TODAS las columnas necesarias en condo_periods
DO $$ 
BEGIN 
    -- tower_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='tower_id') THEN
        ALTER TABLE condo_periods ADD COLUMN tower_id TEXT NOT NULL DEFAULT 'A1';
    ELSE
        -- Por si acaso existe pero está vacía o tiene restricciones raras
        ALTER TABLE condo_periods ALTER COLUMN tower_id SET NOT NULL;
    END IF;
    
    -- period_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='period_name') THEN
        ALTER TABLE condo_periods ADD COLUMN period_name TEXT NOT NULL DEFAULT 'FEBRERO 2026';
    END IF;

    -- reserve_fund
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='reserve_fund') THEN
        ALTER TABLE condo_periods ADD COLUMN reserve_fund DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- bcv_rate
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='bcv_rate') THEN
        ALTER TABLE condo_periods ADD COLUMN bcv_rate DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='status') THEN
        ALTER TABLE condo_periods ADD COLUMN status TEXT DEFAULT 'BORRADOR';
    END IF;

    -- auditoría
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='created_at') THEN
        ALTER TABLE condo_periods ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condo_periods' AND column_name='updated_at') THEN
        ALTER TABLE condo_periods ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 3. Forzar recarga completa
NOTIFY pgrst, 'reload schema';



