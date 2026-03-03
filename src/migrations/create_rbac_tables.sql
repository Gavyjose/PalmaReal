-- SCRIPT DE MIGRACIÓN: Gestión de Usuarios y Permisos Granulares (RBAC)
-- Ejecuta este script en el SQL Editor de Supabase para habilitar las funcionalidades de permisos.

-- 1. Crear tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'OPERADOR' CHECK (role IN ('MASTER', 'OPERADOR', 'VISOR')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear tabla de permisos granulares por módulo
CREATE TABLE IF NOT EXISTS public.module_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_update BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    UNIQUE(profile_id, module_key)
);

-- 3. Habilitar RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.user_profiles;
CREATE POLICY "Users can view their own profiles" ON public.user_profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own permissions" ON public.module_permissions;
CREATE POLICY "Users can view their own permissions" ON public.module_permissions FOR SELECT USING (auth.uid() = profile_id);

-- Los usuarios MASTER pueden gestionarlo todo
DROP POLICY IF EXISTS "Masters can do everything on profiles" ON public.user_profiles;
CREATE POLICY "Masters can do everything on profiles" ON public.user_profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'MASTER')
);

DROP POLICY IF EXISTS "Masters can do everything on permissions" ON public.module_permissions;
CREATE POLICY "Masters can do everything on permissions" ON public.module_permissions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'MASTER')
);

-- 5. Función para actualizar timestamps automáticos
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 6. Disparador para creación automática de perfiles al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'OPERADOR');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Insertar el perfil MASTER inicial para el usuario actual (Opcional, manual es mejor)
-- INSERT INTO public.user_profiles (id, full_name, role) VALUES ('TU_UUID_AQUI', 'Administrador Principal', 'MASTER');
