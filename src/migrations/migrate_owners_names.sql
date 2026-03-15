-- SCRIPT DE MIGRACIÓN: División de Nombres en Tabla Owners
-- Ejecuta este script en el SQL Editor de Supabase.

DO $$ 
BEGIN 
    -- 1. Agregar columnas si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='owners' AND column_name='first_name') THEN
        ALTER TABLE public.owners ADD COLUMN first_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='owners' AND column_name='last_name') THEN
        ALTER TABLE public.owners ADD COLUMN last_name TEXT;
    END IF;

    -- 2. Migrar datos existentes de full_name a first_name y last_name
    -- Dividimos por el primer espacio encontrado
    UPDATE public.owners 
    SET 
        first_name = split_part(trim(full_name), ' ', 1),
        last_name = substring(trim(full_name) from position(' ' in trim(full_name)) + 1)
    WHERE (first_name IS NULL OR first_name = '') 
      AND full_name IS NOT NULL 
      AND full_name <> '';

    -- 3. Limpieza de espacios en blanco
    UPDATE public.owners SET first_name = trim(first_name), last_name = trim(last_name);

    -- 4. Tratar casos donde no había apellido (solo un nombre)
    UPDATE public.owners SET last_name = '' WHERE last_name IS NULL;

END $$;
