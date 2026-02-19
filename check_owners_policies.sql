-- Verificar políticas RLS de la tabla owners
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'owners';

-- Verificar si el ID existe
SELECT id, full_name, email, phone, doc_id
FROM owners
WHERE id = '910c08f2-01cf-42f8-a048-8cb8c5de9833';

-- Ver todas las políticas activas
SELECT * FROM pg_policies WHERE tablename = 'owners';
