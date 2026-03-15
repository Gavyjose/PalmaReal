import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { supabase } from '../supabase';

/**
 * Hook centralizado para los datos del propietario.
 * Retorna: perfil, unidad, deuda total, cuotas especiales y notificaciones.
 */
export const useOwnerData = () => {
    const [user, setUser] = useState(null);
    const { mutate } = useSWRConfig();

    useEffect(() => {
        const getSession = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            setUser(authUser);
        };
        getSession();
    }, []);

    // 1. Fetch Profile & Unit (con SWR para caché y updates automáticos)
    const { data: profileData, error: profileError, isLoading: profileLoading } = useSWR(
        user ? ['profile', user.id] : null,
        async ([_, userId]) => {
            // 1. Obtener perfil básico
            const { data: profile, error: pError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (pError) throw pError;
            if (!profile) return null;

            // 2. Si tiene owner_id, buscar su(s) unidad(es)
            let unit = null;
            if (profile.owner_id) {
                const { data: units, error: uError } = await supabase
                    .from('units')
                    .select('*')
                    .eq('owner_id', profile.owner_id)
                    .limit(1); // Por ahora tomamos la primera vinculada

                if (!uError && units && units.length > 0) {
                    unit = units[0];
                }
            }

            // 3. Fallback: Ver si el email coincide con algún owner (para migración/existentes)
            if (!unit && profile.email) {
                const { data: owner, error: oError } = await supabase
                    .from('owners')
                    .select('id')
                    .eq('email', profile.email)
                    .maybeSingle();

                if (!oError && owner) {
                    const { data: units, error: uError } = await supabase
                        .from('units')
                        .select('*')
                        .eq('owner_id', owner.id)
                        .limit(1);

                    if (!uError && units && units.length > 0) {
                        unit = units[0];
                    }
                }
            }

            return { ...profile, units: unit };
        }
    );

    const unit = profileData?.units;
    const towerId = unit?.tower;

    // 2. Fetch ALL Special Projects for the tower (Active + Closed)
    const { data: projects, isLoading: projectsLoading } = useSWR(
        towerId ? ['specialProjects', towerId] : null,
        async ([_, tId]) => {
            if (!tId) return [];
            const { data, error } = await supabase
                .from('special_quota_projects')
                .select('*')
                .eq('tower_id', tId)
                .order('created_at', { ascending: false });
            if (error) throw error;

            // Enrich each project with total collected and expenses
            const enriched = [];
            for (const proj of (data || [])) {
                // Total recaudado (todos los pagos de todas las unidades)
                const { data: allPayments } = await supabase
                    .from('special_quota_payments')
                    .select('amount')
                    .eq('project_id', proj.id);
                const totalCollected = (allPayments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);

                // Total de gastos del proyecto
                const { data: expenses } = await supabase
                    .from('special_quota_expenses')
                    .select('amount_usd')
                    .eq('project_id', proj.id);
                const totalExpenses = (expenses || []).reduce((s, e) => s + parseFloat(e.amount_usd || 0), 0);

                enriched.push({ ...proj, totalCollected, totalExpenses });
            }
            return enriched;
        }
    );

    // 3. Fetch Payments (Ordinary and Special)
    const { data: payments, isLoading: paymentsLoading } = useSWR(
        unit?.id ? ['unitPayments', unit.id] : null,
        async ([_, uId]) => {
            if (!uId) return { ordinary: [], special: [] };

            // Pagos ordinarios
            const { data: ordPayments } = await supabase
                .from('unit_payments')
                .select('*')
                .eq('unit_id', uId)
                .order('payment_date', { ascending: false });

            // Pagos extraordinarios
            const { data: specPayments } = await supabase
                .from('special_quota_payments')
                .select('*')
                .eq('unit_id', uId)
                .order('payment_date', { ascending: false });

            return {
                ordinary: ordPayments || [],
                special: specPayments || []
            };
        }
    );

    // 4. Fetch Notifications (Announcements)
    const { data: announcements, isLoading: newsLoading } = useSWR(
        'announcements',
        async () => {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);
            if (error) throw error;
            return data;
        }
    );

    // 5. Fetch Building Settings (Bank details)
    const { data: settings, isLoading: settingsLoading } = useSWR(
        profileData?.id ? ['building_settings', profileData.id] : null,
        async () => {
            const { data, error } = await supabase
                .from('building_settings')
                .select('*')
                .maybeSingle();
            if (error) throw error;
            return data;
        }
    );

    // 6. Fetch Pending Periods (History, Condo, Special)
    const { data: pendingPeriods, isLoading: periodsLoading } = useSWR(
        unit?.id ? ['pendingPeriods', unit.id] : null,
        async ([_, uId]) => {
            if (!uId) return { periods: [], totalCondoAliquots: 0 };
            const periods = [];

            // 1. Saldo Histórico (El más antiguo)
            if (unit.initial_debt > 0) {
                periods.push({
                    id: 'INITIAL_DEBT',
                    type: 'HISTORY',
                    period_name: 'Saldo Anterior',
                    amount: parseFloat(unit.initial_debt),
                    sortKey: 0
                });
            }

            // 2. Alícuotas de Condominio
            const { data: condoPeriods } = await supabase
                .from('condo_periods')
                .select('*')
                .eq('tower_id', unit.tower)
                .eq('status', 'PUBLICADO')
                .order('created_at', { ascending: true });

            if (condoPeriods) {
                for (const p of condoPeriods) {
                    periods.push({
                        id: p.id,
                        type: 'CONDO',
                        period_name: p.period_name,
                        amount: parseFloat(p.unit_aliquot_usd),
                        paid_amount: 0,
                        sortKey: new Date(p.created_at).getTime()
                    });
                }
            }

            // 3. Cuotas Especiales (Proyectos Activos)
            const { data: towerProjects } = await supabase
                .from('special_quota_projects')
                .select('*')
                .eq('tower_id', unit.tower)
                .eq('status', 'ACTIVE');

            if (towerProjects) {
                for (const proj of towerProjects) {
                    const { data: specPaid } = await supabase
                        .from('special_quota_payments')
                        .select('amount')
                        .eq('unit_id', uId)
                        .eq('project_id', proj.id);
                    
                    const paid = specPaid?.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) || 0;
                    const totalProjAmount = parseFloat(proj.total_amount_per_unit || 0);
                    const debt = totalProjAmount - paid;

                    if (debt > 0.01) {
                        periods.push({
                            id: `SPEC-${proj.id}`,
                            project_id: proj.id,
                            type: 'SPECIAL',
                            period_name: proj.name,
                            amount: debt, // Exportamos la deuda neta
                            paid_amount: paid,
                            installment_number: 1, // Simplificado
                            sortKey: 9999999999999 // Al final
                        });
                    }
                }
            }

            const totalCondoAliquots = (condoPeriods || []).reduce(
                (sum, p) => sum + parseFloat(p.unit_aliquot_usd || 0), 0
            );

            return { periods, totalCondoAliquots };
        }
    );

    // Filter raw periods using sequential cascading payment surplus
    const getFilteredPeriods = () => {
        const rawData = typeof pendingPeriods === 'object' && !Array.isArray(pendingPeriods)
            ? pendingPeriods
            : { periods: pendingPeriods || [], totalCondoAliquots: 0 };
        
        let list = rawData.periods || [];
        
        if (!payments) return list;

        const totalOrdinaryPaid = (payments.ordinary || []).reduce((sum, p) => sum + parseFloat(p.amount_usd || 0), 0);
        const totalSpecialPaid = (payments.special || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        
        // El fondo disponible para cubrir periodos ordinarios es:
        // (Pagos Totales - Pagos Especiales) + Saldo inicial si era a favor (< 0)
        const initialCredit = unit?.initial_debt < 0 ? Math.abs(parseFloat(unit.initial_debt)) : 0;
        let remainingNetPayment = totalOrdinaryPaid - totalSpecialPaid + initialCredit;

        return list.map(period => {
            if (period.type === 'SPECIAL') return period; // Special items are accurately pre-filtered

            let currentDebt = period.amount;
            if (remainingNetPayment > 0) {
                if (remainingNetPayment >= currentDebt) {
                    remainingNetPayment -= currentDebt;
                    currentDebt = 0;
                } else {
                    currentDebt -= remainingNetPayment;
                    remainingNetPayment = 0;
                }
            }
            return { ...period, amount: currentDebt };
        }).filter(period => period.amount > 0.01);
    };

    const pendingPeriodsData = typeof pendingPeriods === 'object' && !Array.isArray(pendingPeriods)
        ? pendingPeriods
        : { periods: pendingPeriods || [], totalCondoAliquots: 0 };
    
    // Lista procesada final:
    const pendingPeriodsList = getFilteredPeriods();
    const totalCondoAliquots = pendingPeriodsData.totalCondoAliquots || 0;

    // Cálculos de Deuda — Fórmula directa: Cargos − Pagos Ordinarios
    const calculateDebt = () => {
        if (!payments) return { total: 0, ordinary: 0, special: 0 };

        // Total pagado en unit_payments (puede incluir importes de cuotas especiales)
        const totalOrdinaryPaid = (payments.ordinary || []).reduce(
            (sum, p) => sum + parseFloat(p.amount_usd || 0), 0
        );
        // Total pagado específicamente para cuotas especiales
        const totalSpecialPaid = (payments.special || []).reduce(
            (sum, p) => sum + parseFloat(p.amount || 0), 0
        );

        // Deuda ordinaria = Total de cargos ordinarios − lo que se pagó neto para ordinarios
        // Esto maneja correctamente el surplus que cubre arrastre → rebalsa a períodos
        const totalOrdinaryCharges = parseFloat(unit?.initial_debt || 0) + totalCondoAliquots;
        const netOrdinaryPayments = totalOrdinaryPaid - totalSpecialPaid;
        const ordinary = Math.max(0, parseFloat((totalOrdinaryCharges - netOrdinaryPayments).toFixed(2)));

        // Deuda especial — lo que queda de proyectos activos
        const special = pendingPeriodsList
            .filter(p => p.type === 'SPECIAL')
            .reduce((sum, p) => sum + Math.max(0, (p.amount || 0) - (p.paid_amount || 0)), 0);

        return {
            total: parseFloat((ordinary + special).toFixed(2)),
            ordinary: parseFloat(ordinary.toFixed(2)),
            special: parseFloat(special.toFixed(2))
        };
    };

    // 6. Notify Payment (Action)
    const notifyPayment = async (paymentData) => {
        const { amount, amount_bs, bcv_rate, reference, category, projectId, installmentNumber, paymentMethod = 'TRANSFER', file, opDate } = paymentData;

        if (!unit?.id) return { success: false, error: 'No se encontró unidad asociada' };

        try {
            let receiptUrl = null;

            // Subir archivo si existe
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                const filePath = `${unit.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('payment-captures')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('payment-captures')
                    .getPublicUrl(filePath);
                
                receiptUrl = publicUrl;
            }

            // Insertar en unit_payments (Registro Principal)
            const { data: mainPayment, error: mainError } = await supabase
                .from('unit_payments')
                .insert([{
                    unit_id: unit.id,
                    payment_date: opDate || new Date().toISOString().split('T')[0],
                    amount_usd: parseFloat(amount),
                    amount_bs: amount_bs ? parseFloat(amount_bs) : null,
                    bcv_rate: bcv_rate ? parseFloat(bcv_rate) : null,
                    reference: reference,
                    status: 'PENDING',
                    payment_method: paymentMethod,
                    receipt_url: receiptUrl
                }])
                .select()
                .single();

            if (mainError) throw mainError;

            // Si es cuota especial, vincular
            if (category === 'SPECIAL' && projectId) {
                const { error: specError } = await supabase
                    .from('special_quota_payments')
                    .insert([{
                        unit_id: unit.id,
                        project_id: projectId,
                        unit_payment_id: mainPayment.id,
                        amount: parseFloat(amount),
                        amount_bs: amount_bs ? parseFloat(amount_bs) : null,
                        bcv_rate: bcv_rate ? parseFloat(bcv_rate) : null,
                        payment_method: paymentMethod,
                        reference: reference,
                        installment_number: parseInt(installmentNumber) || 1,
                        payment_date: opDate || new Date().toISOString().split('T')[0]
                    }]);

                if (specError) throw specError;
            }

            // Refrescar datos
            mutate(['unitPayments', unit.id]);
            mutate(['pendingPeriods', unit.id]);
            return { success: true };
        } catch (error) {
            console.error('Error notificando pago:', error);
            return { success: false, error };
        }
    };

    return {
        profile: profileData,
        unit,
        projects: projects || [],
        payments: payments || { ordinary: [], special: [] },
        announcements: announcements || [],
        settings,
        debt: calculateDebt(),
        pendingPeriods: pendingPeriodsList,
        notifyPayment,
        loading: profileLoading || projectsLoading || paymentsLoading || newsLoading || settingsLoading || periodsLoading
    };
};
