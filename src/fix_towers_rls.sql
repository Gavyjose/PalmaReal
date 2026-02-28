-- Solución: Crear políticas RLS permisivas para la tabla towers
-- Ejecuta esto en Supabase SQL Editor

-- 1. Habilitar RLS si no está habilitado
ALTER TABLE towers ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON towers;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en towers" ON towers;

-- 3. Crear política permisiva para todas las operaciones (anon y authenticated)
-- Vite usa la anon_key para consultas públicas si no hay sesión estricta (o el token está vencido temporalmente)
CREATE POLICY "Permitir todo en towers"
ON towers
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Verificar
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'towers';
