-- SCRIPT DE REPARACIÓN: user_profiles y Trigger de Auth
-- Ejecuta este script en el SQL Editor de Supabase para corregir el error 500 al crear usuarios.

-- 1. Actualizar la tabla user_profiles con los campos faltantes y roles permitidos
DO $$ 
BEGIN 
    -- Agregar columnas si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='first_name') THEN
        ALTER TABLE public.user_profiles ADD COLUMN first_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='last_name') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='email') THEN
        ALTER TABLE public.user_profiles ADD COLUMN email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='id_card') THEN
        ALTER TABLE public.user_profiles ADD COLUMN id_card TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='phone') THEN
        ALTER TABLE public.user_profiles ADD COLUMN phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='owner_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='must_change_password') THEN
        ALTER TABLE public.user_profiles ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
    END IF;

    -- Actualizar restricción de roles para incluir PROPIETARIO y REPRESENTANTE
    ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check 
        CHECK (role IN ('MASTER', 'OPERADOR', 'VISOR', 'REPRESENTANTE', 'PROPIETARIO'));

END $$;

-- 2. Actualizar la función del disparador para que procese correctamente los metadatos de Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (
        id, 
        full_name, 
        first_name, 
        last_name, 
        email, 
        id_card, 
        phone, 
        role, 
        owner_id, 
        must_change_password
    )
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.email,
        NEW.raw_user_meta_data->>'id_card',
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'role', 'OPERADOR'),
        (NULLIF(NEW.raw_user_meta_data->>'owner_id', ''))::UUID,
        COALESCE((NEW.raw_user_meta_data->>'must_change_password')::BOOLEAN, FALSE)
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        id_card = EXCLUDED.id_card,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        owner_id = EXCLUDED.owner_id,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
