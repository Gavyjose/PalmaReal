-- Solución: Crear políticas RLS permisivas para la tabla owners
-- Ejecuta esto en Supabase SQL Editor

-- 1. Habilitar RLS si no está habilitado
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en owners" ON owners;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON owners;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON owners;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON owners;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON owners;

-- 3. Crear política permisiva para todas las operaciones
CREATE POLICY "Permitir todo a usuarios autenticados en owners"
ON owners
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'owners';
