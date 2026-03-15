-- 1. Permitir a los Propietarios insertar en unit_payments
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'unit_payments' 
        AND policyname = 'Owners can insert their own payments'
    ) THEN
        CREATE POLICY "Owners can insert their own payments"
        ON public.unit_payments
        FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                JOIN public.units u ON u.owner_id = up.owner_id
                WHERE up.id = auth.uid()
                AND u.id = unit_payments.unit_id
                AND up.role = 'PROPIETARIO'
            )
        );
    END IF;
END $$;

-- 2. Permitir a los Propietarios insertar en special_quota_payments
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'special_quota_payments' 
        AND policyname = 'Owners can insert their own special payments'
    ) THEN
        CREATE POLICY "Owners can insert their own special payments"
        ON public.special_quota_payments
        FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                JOIN public.units u ON u.owner_id = up.owner_id
                WHERE up.id = auth.uid()
                AND u.id = special_quota_payments.unit_id
                AND up.role = 'PROPIETARIO'
            )
        );
    END IF;
END $$;
