import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { formatNumber } from '../utils/formatters';
import { sortUnits } from '../utils/unitSort';

const fetchSpecialQuotasData = async ([_, selectedTower]) => {
    if (!selectedTower) return null;

    // 1. Fetch units
    const { data: unitsData } = await supabase
        .from('units')
        .select(`id, number, floor, tower, owners!inner (full_name)`)
        .eq('tower', selectedTower);

    const sortedUnits = sortUnits(unitsData || []);

    // 2. Fetch project
    const { data: projData } = await supabase
        .from('special_quota_projects')
        .select('*')
        .eq('tower_id', selectedTower)
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();

    let finalPayments = [];
    let finalExpenses = [];
    if (projData) {
        // 3. Fetch Payments
        const { data: payData, error: payError } = await supabase
            .from('special_quota_payments')
            .select('*')
            .eq('project_id', projData.id);

        if (payError) {
            console.error('CRITICAL PAYMENTS ERROR:', payError);
        } else if (payData) {
            const parentIds = payData.map(p => p.unit_payment_id).filter(id => id);
            if (parentIds.length > 0) {
                const { data: parents } = await supabase
                    .from('unit_payments')
                    .select('id, amount_bs, amount_usd, bcv_rate, payment_method')
                    .in('id', parentIds);

                if (parents) {
                    const parentMap = {};
                    parents.forEach(p => parentMap[p.id] = p);
                    payData.forEach(p => {
                        if (p.unit_payment_id) p.unit_payments = parentMap[p.unit_payment_id];
                    });
                }
            }
            finalPayments = payData;
        }

        // 4. Fetch Expenses
        const { data: expData, error: expError } = await supabase
            .from('special_quota_expenses')
            .select('*')
            .eq('project_id', projData.id)
            .order('date', { ascending: false });

        if (!expError) {
            finalExpenses = expData || [];
        }
    }

    return {
        units: sortedUnits,
        project: projData || null,
        payments: finalPayments,
        expenses: finalExpenses
    };
};

const SpecialQuotas = () => {
    const { activeTowers, lastSelectedTower, setLastSelectedTower } = useTowers();
    // Initialize from localStorage so first render has a valid tower
    const [localSelectedTower, setLocalSelectedTower] = useState(lastSelectedTower || '');

    useEffect(() => {
        if (activeTowers.length > 0 && !localSelectedTower) {
            const defaultTower = activeTowers.find(t => t.name === lastSelectedTower)?.name || activeTowers[0].name;
            setLocalSelectedTower(defaultTower);
            if (!lastSelectedTower) setLastSelectedTower(defaultTower);
        }
    }, [activeTowers]);

    // Use local selection, fallback to first active tower (never empty string)
    const selectedTower = localSelectedTower || (activeTowers.length > 0 ? activeTowers[0].name : null);


    const { data, isLoading: isDataLoading, mutate: mutateData } = useSWR(
        selectedTower ? ['specialQuotas', selectedTower] : null,
        fetchSpecialQuotasData
    );

    const units = data?.units || [];
    const project = data?.project || null;
    const payments = data?.payments || [];
    const projectExpenses = data?.expenses || [];

    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [isMutating, setIsMutating] = useState(false);
    const [expandedUnitId, setExpandedUnitId] = useState(null);

    const loading = isDataLoading || isMutating;

    const [newExpense, setNewExpense] = useState({
        description: '',
        category: 'MATERIALES',
        amount_bs: '',
        bcv_rate: 0,
        amount_usd: '',
        date: new Date().toISOString().split('T')[0],
        reference: ''
    });
    const [loadingExpenseRate, setLoadingExpenseRate] = useState(false);

    useEffect(() => {
        if (showExpenseModal && newExpense.date) {
            fetchExpenseRateForDate(newExpense.date);
        }
    }, [showExpenseModal, newExpense.date]);

    const fetchExpenseRateForDate = async (date) => {
        try {
            setLoadingExpenseRate(true);
            const { data: rateData, error } = await supabase.rpc('get_bcv_rate', { p_date: date });
            if (error) throw error;
            if (rateData) {
                const rate = parseFloat(rateData);
                setNewExpense(prev => {
                    const usd = prev.amount_bs && rate > 0 ? (parseFloat(prev.amount_bs) / rate).toFixed(2) : prev.amount_usd;
                    return { ...prev, bcv_rate: rate, amount_usd: usd };
                });
            }
        } catch (error) {
            console.error('Error fetching expense rate:', error);
        } finally {
            setLoadingExpenseRate(false);
        }
    };
    const [newProject, setNewProject] = useState({
        name: '',
        total_budget: '',
        installments_count: 4,
        tower_id: selectedTower
    });
    const [selectedUnitForPayment, setSelectedUnitForPayment] = useState(null);
    const [paymentDetails, setPaymentDetails] = useState({
        amount: '',
        reference: '',
        installment_number: 1,
        amount_bs: '',
        bcv_rate: 0,
        payment_method: 'TRANSFER',
        payment_date: new Date().toISOString().split('T')[0]
    });
    const [loadingRate, setLoadingRate] = useState(false);

    useEffect(() => {
        if (showPaymentModal && paymentDetails.payment_method === 'TRANSFER' && paymentDetails.payment_date) {
            fetchRateForDate(paymentDetails.payment_date);
        }
    }, [showPaymentModal, paymentDetails.payment_method, paymentDetails.payment_date]);

    const fetchRateForDate = async (date) => {
        try {
            setLoadingRate(true);
            const { data, error } = await supabase.rpc('get_bcv_rate', { p_date: date });
            if (error) throw error;
            if (data) {
                setPaymentDetails(prev => ({ ...prev, bcv_rate: parseFloat(data) }));
            }
        } catch (error) {
            console.error('Error fetching rate:', error);
        } finally {
            setLoadingRate(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProject.name || !newProject.total_budget) {
            alert('Por favor completa el nombre y el presupuesto.');
            return;
        }

        try {
            setIsMutating(true);
            const { data, error } = await supabase
                .from('special_quota_projects')
                .insert([{
                    name: newProject.name.toUpperCase(),
                    total_budget: parseFloat(newProject.total_budget),
                    installments_count: parseInt(newProject.installments_count),
                    tower_id: selectedTower,
                    status: 'ACTIVE'
                }])
                .select()
                .single();

            if (error) throw error;

            setShowProjectModal(false);
            alert('✅ Proyecto creado exitosamente.');
            mutateData();
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Error al crear proyecto: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const handleRepairData = async () => {
        try {
            setLoading(true);
            // 1. Get all payments for this project
            const { data: allPay, error: fetchError } = await supabase
                .from('special_quota_payments')
                .select('*')
                .eq('project_id', project?.id);

            if (fetchError) throw fetchError;

            // Filter rows that need repair (Bs is null or 0)
            const missingPay = allPay.filter(p => !p.amount_bs || parseFloat(p.amount_bs) === 0);

            if (!missingPay || missingPay.length === 0) {
                alert('No hay pagos pendientes de reparación.');
                return;
            }

            console.log(`Analizando ${missingPay.length} registros potenciales...`);
            let repaired = 0;

            for (const p of missingPay) {
                const unitNumber = units.find(u => u.id === p.unit_id)?.number;
                const searchRef = (p.reference || '').trim();
                console.log(`Buscando matriz para U-${unitNumber} | Ref: ${searchRef}`);

                if (!searchRef) {
                    console.warn('Registro sin referencia, saltando.');
                    continue;
                }

                try {
                    // Try exact match first (Faster and safer)
                    let { data: ups, error: upsErr } = await supabase
                        .from('unit_payments')
                        .select('*')
                        .eq('unit_id', p.unit_id)
                        .eq('reference', searchRef);

                    // Fallback to ilike if no exact match
                    if ((!ups || ups.length === 0) && !upsErr) {
                        const { data: ilikeUps, error: ilikeErr } = await supabase
                            .from('unit_payments')
                            .select('*')
                            .eq('unit_id', p.unit_id)
                            .ilike('reference', `%${searchRef}%`);
                        ups = ilikeUps;
                        upsErr = ilikeErr;
                    }

                    if (upsErr) {
                        console.error(`Error querying unit_payments for U-${unitNumber}:`, upsErr);
                        continue;
                    }

                    if (ups && ups.length > 0) {
                        const up = ups[0];
                        console.log(`   MATCH: $${up.amount_usd} -> Bs. ${up.amount_bs}`);

                        await supabase
                            .from('special_quota_payments')
                            .update({
                                unit_payment_id: up.id
                            })
                            .eq('id', p.id);
                        repaired++;
                    } else {
                        console.warn(`No se encontró coincidencia para Ref: ${searchRef} en la unidad ${unitNumber}`);
                    }
                } catch (loopErr) {
                    console.error('Crash in repair loop:', loopErr);
                }
            }

            alert(`✅ Sincronización finalizada: ${repaired} registros de auditoría vinculados.`);
            mutateData();
        } catch (error) {
            console.error('Error reparando datos:', error);
            alert('Error en reparación: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const handleRegisterPayment = async () => {
        if (!selectedUnitForPayment || !paymentDetails.amount) {
            alert('Completa los datos del pago.');
            return;
        }

        try {
            setIsMutating(true);
            const { error } = await supabase
                .from('special_quota_payments')
                .insert([{
                    project_id: project.id,
                    unit_id: selectedUnitForPayment.id,
                    installment_number: parseInt(paymentDetails.installment_number),
                    amount: parseFloat(paymentDetails.amount),
                    reference: paymentDetails.reference.toUpperCase(),
                    payment_date: paymentDetails.payment_date
                }]);

            if (error) throw error;

            alert('✅ Pago registrado exitosamente.');
            setShowPaymentModal(false);
            mutateData();
        } catch (error) {
            console.error('Error registering payment:', error);
            alert('Error al registrar pago: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const handleRegisterExpense = async () => {
        if (!newExpense.description || !newExpense.amount_bs) {
            alert('Completa los datos del egreso (descripción y monto en Bs).');
            return;
        }
        if (!newExpense.bcv_rate || newExpense.bcv_rate <= 0) {
            alert('No se pudo obtener la tasa BCV. Verifica la fecha.');
            return;
        }

        const amountBs = parseFloat(newExpense.amount_bs);
        const amountUsd = amountBs / newExpense.bcv_rate;

        try {
            setIsMutating(true);
            const { error } = await supabase
                .from('special_quota_expenses')
                .insert([{
                    project_id: project.id,
                    description: newExpense.description.toUpperCase(),
                    category: newExpense.category,
                    amount_bs: amountBs,
                    bcv_rate: newExpense.bcv_rate,
                    amount_usd: parseFloat(amountUsd.toFixed(2)),
                    date: newExpense.date,
                    reference: newExpense.reference ? newExpense.reference.toUpperCase() : null
                }]);

            if (error) throw error;

            alert('✅ Egreso registrado exitosamente.');
            setShowExpenseModal(false);
            setNewExpense({
                description: '',
                category: 'MATERIALES',
                amount_bs: '',
                bcv_rate: 0,
                amount_usd: '',
                date: new Date().toISOString().split('T')[0],
                reference: ''
            });
            mutateData();
        } catch (error) {
            console.error('Error registering expense:', error);
            alert('Error al registrar egreso: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const quotaPerUnit = project ? (project.total_budget / units.length) || 0 : 0;
    const amountPerInstallment = project ? (project.total_budget / (units.length * project.installments_count)) || 0 : 0;
    const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalCollectedBs = payments.reduce((sum, p) => {
        const directBs = parseFloat(p.amount_bs) || 0;
        const joinedBs = p.unit_payments?.amount_bs ? (p.unit_payments.amount_bs * (p.amount / (p.unit_payments.amount_usd || 1))) : 0;
        return sum + (directBs || joinedBs);
    }, 0);
    const totalCollectedCashUSD = payments.reduce((sum, p) => {
        const isCash = (p.payment_method || p.unit_payments?.payment_method) === 'CASH';
        return isCash ? sum + parseFloat(p.amount) : sum;
    }, 0);
    const totalExecuted = projectExpenses.reduce((sum, e) => sum + parseFloat(e.amount_usd), 0);
    const totalExecutedMaterials = projectExpenses.filter(e => e.category === 'MATERIALES').reduce((sum, e) => sum + parseFloat(e.amount_usd), 0);
    const totalExecutedLabor = projectExpenses.filter(e => e.category === 'MANO DE OBRA').reduce((sum, e) => sum + parseFloat(e.amount_usd), 0);
    const currentCashBalance = totalCollected - totalExecuted;
    const remainingBudget = project ? project.total_budget - totalCollected : 0;
    const progressPercent = project ? (totalCollected / project.total_budget) * 100 : 0;
    const executionPercent = project ? (totalExecuted / project.total_budget) * 100 : 0;

    const isPaid = (unitId, installment) => {
        return payments.some(p => p.unit_id === unitId && p.installment_number === installment);
    };

    return (
        <div className="flex flex-col flex-1 max-w-[1400px] mx-auto w-full p-4 lg:p-10 gap-8 min-h-screen animate-fade-in text-slate-800 dark:text-slate-100">
            {/* Page Header */}
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div className="flex flex-col gap-1">
                    <nav className="flex text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-2 gap-2 items-center">
                        <span className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Finanzas</span>
                        <span>/</span>
                        <span className="text-slate-900 dark:text-white">Gestión de Cuotas</span>
                    </nav>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Presupuestos y Cuotas Especiales</h1>
                    <p className="text-slate-500 text-sm mt-1 font-mono">Seguimiento financiero para el mantenimiento extraordinario.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Bloque Activo</span>
                        <select
                            value={selectedTower}
                            onChange={(e) => {
                                setLocalSelectedTower(e.target.value);
                                setLastSelectedTower(e.target.value);
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none px-4 py-2 font-mono text-sm uppercase font-bold outline-none focus:border-slate-900 dark:focus:border-white shadow-sm"
                        >
                            {activeTowers.map(t => <option key={t.name} value={t.name}>Torre {t.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end gap-2">
                        <button className="flex items-center justify-center rounded-none h-[42px] px-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold uppercase tracking-widest gap-2 border border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white transition-colors">
                            <span className="material-icons text-sm">download</span>
                            <span>Exportar Base</span>
                        </button>
                        {project && (
                            <button
                                onClick={() => setShowExpenseModal(true)}
                                className="flex items-center justify-center rounded-none h-[42px] px-4 bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-widest gap-2 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            >
                                <span className="material-icons text-sm">payments</span>
                                <span>Reportar Gasto</span>
                            </button>
                        )}
                        {project ? (
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                className="flex items-center justify-center rounded-none h-[42px] px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest gap-2 hover:invert transition-all border-2 border-transparent"
                            >
                                <span className="material-icons text-sm">add_circle</span>
                                <span>Abonar Cuota</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowProjectModal(true)}
                                className="flex items-center justify-center rounded-none h-[42px] px-6 bg-emerald-700 dark:bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest gap-2 hover:bg-emerald-800 transition-colors border-2 border-transparent"
                            >
                                <span className="material-icons text-sm">rocket_launch</span>
                                <span>Lanzar Proyecto</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {!project ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-slate-50 dark:bg-slate-900/50 rounded-none border border-slate-300 dark:border-slate-700 p-12 text-center group">
                    <div className="w-16 h-16 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:border-slate-900 transition-colors">
                        <span className="material-icons text-3xl text-slate-400">account_balance_wallet</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Sin Iniciativas Activas</h3>
                    <p className="text-slate-500 max-w-md mb-8 font-mono text-sm leading-relaxed">Libro mayor en blanco. Defina un nuevo bloque presupuestario para la Torre {selectedTower} y asocie cuotas de recolección.</p>
                    <button
                        onClick={() => setShowProjectModal(true)}
                        className="px-8 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-none font-bold uppercase tracking-widest text-xs hover:invert transition-all flex items-center gap-2 border-2 border-transparent"
                    >
                        <span className="material-icons text-sm">add</span> Asignar Presupuesto
                    </button>
                </div>
            ) : (
                <>
                    {/* Configuration & KPIs */}
                    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Config Panel */}
                        <div className="xl:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-none border border-slate-300 dark:border-slate-800 shadow-none relative overflow-hidden">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 border-b-2 border-slate-900 dark:border-white inline-block pb-1">Desglose Técnico</h3>
                            <div className="space-y-6">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volumen Bruto Objetivo</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">$</span>
                                        <input className="w-full pl-8 py-2 rounded-none border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-slate-900 dark:focus:border-white outline-none font-mono font-bold text-lg" type="text" value={formatNumber(project.total_budget)} readOnly />
                                    </div>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fraccionamiento (Cuotas)</span>
                                    <div className="px-4 py-2 rounded-none bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono font-bold text-lg text-slate-900 dark:text-white">
                                        {project.installments_count} PARTES
                                    </div>
                                </label>
                                <div className="pt-4 border-t border-slate-300 dark:border-slate-800 flex flex-col gap-3 font-mono text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Denominación:</span>
                                        <span className="font-bold text-slate-900 dark:text-white uppercase truncate max-w-[150px]">{project.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">Estado P/G:</span>
                                        <span className="px-2 py-0.5 border border-slate-900 text-slate-900 dark:border-white dark:text-white text-[10px] font-bold uppercase tracking-widest">{project.status}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KPI Cards */}
                        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="flex flex-col justify-between rounded-none p-5 bg-white dark:bg-slate-900 border-t-4 border-emerald-600 border-x border-b border-slate-300 dark:border-slate-800 relative overflow-hidden">
                                <div className="flex justify-between items-start">
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Recaudado</p>
                                    <span className="text-[10px] font-mono font-bold text-emerald-600 px-2 py-0.5 border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800">{progressPercent.toFixed(1)}%</span>
                                </div>
                                <div className="mt-4">
                                    <p className="text-2xl font-mono font-black text-emerald-600">${formatNumber(totalCollected)}</p>
                                    <p className="text-[9px] text-slate-400 font-mono mt-1">Efectivo: ${formatNumber(totalCollectedCashUSD)}</p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between rounded-none p-5 bg-white dark:bg-slate-900 border-t-4 border-red-600 border-x border-b border-slate-300 dark:border-slate-800 relative overflow-hidden">
                                <div className="flex justify-between items-start">
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Ejecutado (Gastos)</p>
                                    <span className="text-[10px] font-mono font-bold text-red-600 px-2 py-0.5 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">{executionPercent.toFixed(1)}%</span>
                                </div>
                                <div className="mt-4">
                                    <p className="text-2xl font-mono font-black text-red-600">${formatNumber(totalExecuted)}</p>
                                    <p className="text-[9px] text-slate-400 font-mono mt-1">Mat: {formatNumber(totalExecutedMaterials)} | M.O: {formatNumber(totalExecutedLabor)}</p>
                                </div>
                            </div>
                            <div className={`flex flex-col justify-between rounded-none p-5 bg-white dark:bg-slate-900 border-t-4 ${currentCashBalance >= 0 ? 'border-amber-500' : 'border-red-800'} border-x border-b border-slate-300 dark:border-slate-800 relative overflow-hidden shadow-lg shadow-slate-200/50 dark:shadow-none`}>
                                <div className="flex justify-between items-start">
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Saldo en Caja</p>
                                    <span className={`material-icons text-sm ${currentCashBalance >= 0 ? 'text-amber-500' : 'text-red-800'}`}>
                                        {currentCashBalance >= 0 ? 'account_balance_wallet' : 'warning'}
                                    </span>
                                </div>
                                <div className="mt-4">
                                    <p className={`text-2xl font-mono font-black ${currentCashBalance >= 0 ? 'text-amber-600' : 'text-red-800'}`}>
                                        ${formatNumber(Math.abs(currentCashBalance))}
                                        {currentCashBalance < 0 && <span className="text-xs ml-1">(SOBREGIRO)</span>}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-mono mt-1">Fondos disponibles para ejecutar</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Integrated Special Quotas Ledger */}
                    <section className="flex flex-col gap-4 mb-20 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Integración de Cobranza (Torre {selectedTower})</h2>
                                {project && (
                                    <button
                                        onClick={handleRepairData}
                                        className="px-2 py-1 text-[8px] font-bold uppercase tracking-widest border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-colors"
                                    >
                                        Sincronizar Bs.
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-4">
                                <span className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span className="w-2 h-2 bg-emerald-500"></span> Total Pagado
                                </span>
                                <span className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span className="w-2 h-2 bg-red-500"></span> Pendiente
                                </span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm max-h-[580px] overflow-y-auto custom-scrollbar-thin">
                            {/* Header row */}
                            <div className="grid grid-cols-12 gap-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-300 dark:border-slate-700 px-6 py-4 hide-scrollbar overflow-x-auto sticky top-0 z-20">
                                <div className="col-span-3 min-w-[120px] text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Identificador</div>
                                <div className="col-span-4 min-w-[180px] text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Razón Social</div>
                                <div className="col-span-2 min-w-[100px] text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 text-right">Total Pagado</div>
                                <div className="col-span-2 min-w-[100px] text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-500 text-right">Deuda Pendiente</div>
                                <div className="col-span-1 min-w-[60px] text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Audit</div>
                            </div>

                            {/* Body */}
                            <div className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
                                {units.map((unit) => {
                                    const unitPayments = payments.filter(p => p.unit_id === unit.id);
                                    const unitPaidAmount = unitPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                                    const unitDebtAmount = quotaPerUnit - unitPaidAmount;
                                    const isExpanded = expandedUnitId === unit.id;

                                    return (
                                        <div key={unit.id} className="flex flex-col transition-colors">
                                            {/* Main Row */}
                                            <div
                                                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/80' : ''}`}
                                                onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                                            >
                                                <div className="col-span-3 min-w-[120px]">
                                                    <span className="font-black text-slate-900 dark:text-white text-sm uppercase">U-{unit.number}</span>
                                                </div>
                                                <div className="col-span-4 min-w-[180px] flex items-center gap-2">
                                                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase truncate font-mono">{unit.owners?.full_name || '--'}</span>
                                                </div>
                                                <div className="col-span-2 min-w-[100px] text-right">
                                                    <span className={`font-black font-mono text-sm ${unitPaidAmount > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-400'}`}>
                                                        {unitPaidAmount > 0 ? `$${formatNumber(unitPaidAmount)}` : '--'}
                                                    </span>
                                                </div>
                                                <div className="col-span-2 min-w-[100px] text-right">
                                                    <span className={`font-black font-mono text-sm ${unitDebtAmount > 0 ? 'text-red-600 dark:text-red-500' : 'text-slate-400'}`}>
                                                        {unitDebtAmount > 0 ? `$${formatNumber(unitDebtAmount)}` : '--'}
                                                    </span>
                                                </div>
                                                <div className="col-span-1 min-w-[60px] flex justify-center">
                                                    <span className={`material-icons text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-slate-900 dark:text-white' : ''}`}>
                                                        expand_more
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expanded Audit Log */}
                                            {isExpanded && (
                                                <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-6 shadow-inner animate-fade-in flex flex-col xl:flex-row gap-8">
                                                    {/* Installments Visualizer */}
                                                    <div className="flex flex-col gap-3 min-w-[200px]">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2 inline-block">Liquidación de Tramos</span>
                                                        <div className="flex gap-2 flex-wrap">
                                                            {[...Array(project.installments_count)].map((_, i) => {
                                                                const isPaidInst = isPaid(unit.id, i + 1);
                                                                return (
                                                                    <div key={i} className="flex flex-col gap-1 items-center">
                                                                        <span className="text-[9px] font-mono font-bold text-slate-400">#{i + 1}</span>
                                                                        {isPaidInst ? (
                                                                            <div className="w-8 h-8 bg-emerald-500 text-white flex items-center justify-center shadow-sm" title="Tramo Pagado">
                                                                                <span className="material-icons text-[14px] font-black">check</span>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedUnitForPayment(unit);
                                                                                    setPaymentDetails({
                                                                                        ...paymentDetails,
                                                                                        installment_number: i + 1,
                                                                                        amount: amountPerInstallment.toFixed(2)
                                                                                    });
                                                                                    setShowPaymentModal(true);
                                                                                }}
                                                                                className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 hover:border-slate-900 dark:hover:border-white transition-colors cursor-pointer bg-white dark:bg-slate-900 flex items-center justify-center group"
                                                                                title="Liquidar Tramo"
                                                                            >
                                                                                <span className="material-icons text-[16px] text-transparent group-hover:text-slate-300">add</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Ledger Table */}
                                                    <div className="flex flex-col gap-3 flex-1 overflow-x-auto">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2 inline-block">Libro Mayor Transaccional</span>
                                                        {unitPayments.length === 0 ? (
                                                            <div className="text-center py-6 text-slate-400 font-mono text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-dashed">
                                                                No hay abonos registrados para esta unidad en este proyecto.
                                                            </div>
                                                        ) : (
                                                            <div className="min-w-[600px]">
                                                                <table className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                                                                    <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                                                                        <tr>
                                                                            <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 w-28">Registro</th>
                                                                            <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 text-right w-32">Importe ($)</th>
                                                                            <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 w-36">Importe (Bs.)</th>
                                                                            <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800">Ref / Traza</th>
                                                                            <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 text-center w-28">Asignación</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                        {unitPayments.map(p => (
                                                                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                                                <td className="px-4 py-3 text-xs font-mono font-bold text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                                                                                    {new Date(p.payment_date).toLocaleDateString('es-VE')}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-xs font-mono font-black text-emerald-600 dark:text-emerald-500 text-right bg-emerald-50/30 dark:bg-emerald-900/10 border-r border-slate-100 dark:border-slate-800">
                                                                                    ${formatNumber(p.amount)}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                                                                                    {p.amount_bs ? `Bs. ${formatNumber(p.amount_bs)}` :
                                                                                        (p.unit_payments?.amount_bs ? `Bs. ${formatNumber(p.unit_payments.amount_bs * (p.amount / (p.unit_payments.amount_usd || 1)))}*` : '--')}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-[10px] font-mono font-bold text-slate-500 uppercase border-r border-slate-100 dark:border-slate-800">
                                                                                    {p.reference || '--'}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center border-r border-slate-100 dark:border-slate-800">
                                                                                    <span className="px-2 py-1 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-[9px] font-bold uppercase font-mono bg-slate-50 dark:bg-slate-800 inline-block">
                                                                                        TRAMO {p.installment_number}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900 dark:bg-slate-950 text-white border-t-2 border-slate-900 px-6 py-4 items-center shadow-inner sticky bottom-0 z-20">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-0">
                                    <span className="font-black uppercase text-[10px] tracking-widest text-slate-400">Resumen Cierre</span>
                                    <div className="flex gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] uppercase text-slate-500 tracking-tighter">Total en Bolívares</span>
                                            <span className="text-white font-mono font-bold text-xs">Bs. {formatNumber(totalCollectedBs)}</span>
                                        </div>
                                        <div className="w-[1px] bg-slate-700 self-stretch"></div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] uppercase text-slate-500 tracking-tighter">Acumulado Efectivo ($)</span>
                                            <span className="text-emerald-400 font-mono font-black text-xs">${formatNumber(totalCollectedCashUSD)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-start md:justify-end border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
                                    <div className="grid grid-cols-2 gap-8 items-center text-right">
                                        <div className="flex flex-col items-end border-r border-slate-700 pr-8">
                                            <span className="text-[8px] uppercase text-slate-500 tracking-tighter mb-1">Total Pagado</span>
                                            <span className="font-black font-mono text-emerald-400 text-xl">${formatNumber(totalCollected)}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] uppercase text-slate-500 tracking-tighter mb-1">Morosidad Global</span>
                                            <span className="font-black font-mono text-red-400 text-xl">${formatNumber(remainingBudget)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Expenses Relationship Section */}
                    <section className="flex flex-col gap-4 animate-fade-in mb-20">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Relación de Ejecución (Egresos)</h2>
                            <div className="flex gap-4 font-mono text-[10px] uppercase font-bold text-slate-500">
                                <span>Materiales: <span className="text-slate-900 dark:text-white">${formatNumber(totalExecutedMaterials)}</span></span>
                                <span>Mano de Obra: <span className="text-slate-900 dark:text-white">${formatNumber(totalExecutedLabor)}</span></span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm">
                            <div className="grid grid-cols-12 gap-4 bg-slate-100 dark:bg-slate-950 border-b border-slate-300 dark:border-slate-700 px-6 py-4">
                                <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Fecha</div>
                                <div className="col-span-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Descripción</div>
                                <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Categoría</div>
                                <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Monto (Bs.)</div>
                                <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Equiv. USD</div>
                                <div className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Ref</div>
                            </div>
                            <div className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                                {projectExpenses.length === 0 ? (
                                    <div className="px-6 py-12 text-center text-slate-400 font-mono text-sm uppercase">Sin egresos registrados para este proyecto.</div>
                                ) : (
                                    projectExpenses.map((exp) => (
                                        <div key={exp.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <div className="col-span-2 font-mono text-xs text-slate-500">{exp.date}</div>
                                            <div className="col-span-3 font-bold text-xs text-slate-900 dark:text-white uppercase">{exp.description}</div>
                                            <div className="col-span-2">
                                                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border ${exp.category === 'MATERIALES' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    exp.category === 'MANO DE OBRA' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                        'bg-slate-50 text-slate-600 border-slate-100'
                                                    }`}>
                                                    {exp.category}
                                                </span>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <span className="font-black font-mono text-sm text-slate-900 dark:text-white">Bs. {formatNumber(exp.amount_bs)}</span>
                                                <p className="text-[9px] text-slate-400 font-mono">@{formatNumber(exp.bcv_rate)}</p>
                                            </div>
                                            <div className="col-span-2 text-right font-black font-mono text-sm text-emerald-600">
                                                ${formatNumber(exp.amount_usd)}
                                            </div>
                                            <div className="col-span-1 text-right font-mono text-[10px] text-slate-400 truncate">
                                                {exp.reference || '--'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {projectExpenses.length > 0 && (
                                <div className="bg-slate-900 dark:bg-slate-950 px-6 py-3 flex justify-between items-center text-white font-mono">
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Total Ejecutado Acumulado</span>
                                    <span className="font-black text-lg">${formatNumber(totalExecuted)}</span>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {/* Modal: Nuevo Proyecto */}
            {showProjectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-none w-full max-w-md shadow-2xl">
                        <div className="p-6 border-b-2 border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Formular Nuevo Presupuesto</h3>
                            <p className="font-mono text-xs text-slate-500 mt-2">Defina el requerimiento de capital para el bloque {selectedTower}.</p>
                        </div>
                        <div className="p-6 space-y-5 text-slate-700 dark:text-slate-300">
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Designación del Requerimiento</span>
                                <input
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white transition-colors"
                                    placeholder="EJ: IMPERMEABILIZACIÓN ESTRUCTURA"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Capital Necesario (Base USD)</span>
                                <input
                                    type="number"
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white transition-colors"
                                    placeholder="00.00"
                                    value={newProject.total_budget}
                                    onChange={(e) => setNewProject({ ...newProject, total_budget: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Amortización (Tramos)</span>
                                <select
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white transition-colors"
                                    value={newProject.installments_count}
                                    onChange={(e) => setNewProject({ ...newProject, installments_count: e.target.value })}
                                >
                                    <option value="1">Ejecución Única (1)</option>
                                    <option value="2">Bimestral (2)</option>
                                    <option value="3">Trimestral (3)</option>
                                    <option value="4">Cuatrimestral (4)</option>
                                    <option value="6">Semestral (6)</option>
                                    <option value="12">Anualizado (12)</option>
                                </select>
                            </label>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-3">
                            <button
                                onClick={() => setShowProjectModal(false)}
                                className="flex-1 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-none font-bold text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:border-slate-900 dark:hover:border-white transition-colors"
                            >
                                ABORTAR
                            </button>
                            <button
                                onClick={handleCreateProject}
                                className="flex-1 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-none font-bold text-xs uppercase tracking-widest hover:invert transition-all border-2 border-transparent"
                            >
                                EJECUTAR INICIATIVA
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Registrar Pago */}
            {showPaymentModal && project && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-none w-full max-w-md shadow-2xl">
                        <div className="p-6 border-b-2 border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Liquidación de Fracción</h3>
                            <div className="font-mono text-xs text-slate-500 mt-2 flex items-center gap-2">
                                <span className="px-2 py-0.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                                    {selectedUnitForPayment ? `U-${selectedUnitForPayment.number}` : '---'}
                                </span>
                                <span>·</span>
                                <span className="font-bold">TRAMO {paymentDetails.installment_number}</span>
                            </div>
                        </div>
                        <div className="p-6 space-y-5">
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Fecha de Operación</span>
                                <input
                                    type="date"
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white transition-colors"
                                    value={paymentDetails.payment_date}
                                    onChange={(e) => setPaymentDetails({ ...paymentDetails, payment_date: e.target.value })}
                                />
                            </label>

                            {!selectedUnitForPayment ? (
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Clave de Unidad</span>
                                    <select
                                        className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white transition-colors"
                                        onChange={(e) => setSelectedUnitForPayment(units.find(u => u.id === e.target.value))}
                                    >
                                        <option value="">Seleccionar Base...</option>
                                        {units.map(u => <option key={u.id} value={u.id}>U-{u.number} · {u.owners?.full_name}</option>)}
                                    </select>
                                </label>
                            ) : null}
                            <div className="flex gap-2 bg-slate-50 dark:bg-slate-800/50 p-1 border border-slate-300 dark:border-slate-700">
                                <button
                                    onClick={() => setPaymentDetails({ ...paymentDetails, payment_method: 'TRANSFER' })}
                                    className={`flex-1 py-3 px-2 text-[10px] font-mono font-black tracking-widest uppercase transition-colors flex items-center justify-center gap-2 border-2 ${paymentDetails.payment_method === 'TRANSFER'
                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-none'
                                        : 'border-transparent text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <span className="material-icons text-sm">account_balance</span> BANCO
                                </button>
                                <button
                                    onClick={() => setPaymentDetails({ ...paymentDetails, payment_method: 'CASH' })}
                                    className={`flex-1 py-3 px-2 text-[10px] font-mono font-black tracking-widest uppercase transition-colors flex items-center justify-center gap-2 border-2 ${paymentDetails.payment_method === 'CASH'
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-none'
                                        : 'border-transparent text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <span className="material-icons text-sm">payments</span> DIVISAS
                                </button>
                            </div>

                            {paymentDetails.payment_method === 'TRANSFER' ? (
                                <>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Emisión Regulada (Bs.)</span>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">Bs.</span>
                                            <input
                                                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-black text-xl text-slate-900 dark:text-white transition-colors"
                                                type="number"
                                                placeholder="0.00"
                                                value={paymentDetails.amount_bs}
                                                onChange={(e) => {
                                                    const bs = e.target.value;
                                                    const usd = paymentDetails.bcv_rate > 0 ? (parseFloat(bs) / paymentDetails.bcv_rate).toFixed(2) : paymentDetails.amount;
                                                    setPaymentDetails({ ...paymentDetails, amount_bs: bs, amount: usd });
                                                }}
                                            />
                                        </div>
                                    </label>
                                    <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tasa BCV Referencial</span>
                                            {loadingRate && <span className="material-icons text-xs animate-spin">sync</span>}
                                        </div>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none font-mono font-bold text-sm outline-none"
                                            value={paymentDetails.bcv_rate}
                                            onChange={(e) => setPaymentDetails({ ...paymentDetails, bcv_rate: e.target.value })}
                                        />
                                    </div>
                                </>
                            ) : null}

                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                                    {paymentDetails.payment_method === 'CASH' ? 'Valor Liquidado (USD)' : 'Equivalente Final (USD)'}
                                </span>
                                <input
                                    className={`px-4 py-3 border-2 rounded-none focus:outline-none focus:ring-0 font-mono font-black text-lg transition-colors ${paymentDetails.payment_method === 'CASH'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                        }`}
                                    type="number"
                                    value={paymentDetails.amount}
                                    onChange={(e) => setPaymentDetails({ ...paymentDetails, amount: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Código Rastro Operativo (Ref)</span>
                                <input
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white transition-colors"
                                    placeholder="OPCIONAL"
                                    value={paymentDetails.reference}
                                    onChange={(e) => setPaymentDetails({ ...paymentDetails, reference: e.target.value })}
                                />
                            </label>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setSelectedUnitForPayment(null);
                                }}
                                className="flex-1 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-none font-bold text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:border-slate-900 dark:hover:border-white transition-colors"
                            >
                                ABORTAR
                            </button>
                            <button
                                onClick={handleRegisterPayment}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-none font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors border border-transparent"
                            >
                                ASENTAR LIQUIDACIÓN
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Expense Registration Modal */}
            {showExpenseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md shadow-2xl border border-slate-300 dark:border-slate-700 animate-slide-up">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-600 flex items-center justify-center text-white shadow-lg">
                                    <span className="material-icons text-xl">payments</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Reportar Egreso</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Liquidación de gastos del proyecto</p>
                                </div>
                            </div>
                            <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Descripción del Gasto</span>
                                <input
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white placeholder:text-slate-300"
                                    placeholder="EJ: COMPRA DE CEMENTO, PAGO PINTURA..."
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value.toUpperCase() })}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Categoría</span>
                                <select
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white uppercase cursor-pointer"
                                    value={newExpense.category}
                                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                                >
                                    <option value="MATERIALES">MATERIALES</option>
                                    <option value="MANO DE OBRA">MANO DE OBRA</option>
                                    <option value="OTROS">OTROS</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Fecha de Compra</span>
                                <input
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white"
                                    type="date"
                                    value={newExpense.date}
                                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Monto Pagado (Bs.)</span>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">Bs.</span>
                                    <input
                                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-black text-xl text-slate-900 dark:text-white"
                                        type="number"
                                        placeholder="0.00"
                                        value={newExpense.amount_bs}
                                        onChange={(e) => {
                                            const bs = e.target.value;
                                            const usd = newExpense.bcv_rate > 0 ? (parseFloat(bs) / newExpense.bcv_rate).toFixed(2) : '';
                                            setNewExpense({ ...newExpense, amount_bs: bs, amount_usd: usd });
                                        }}
                                    />
                                </div>
                            </label>
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tasa BCV del Día</span>
                                    {loadingExpenseRate && <span className="material-icons text-xs animate-spin text-slate-400">sync</span>}
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-mono font-bold text-sm text-slate-600 dark:text-slate-300">
                                        {newExpense.bcv_rate > 0 ? `Bs. ${formatNumber(newExpense.bcv_rate)} / $1` : 'Cargando...'}
                                    </span>
                                    <span className="font-mono font-black text-lg text-emerald-600">
                                        {newExpense.amount_usd ? `≈ $${formatNumber(parseFloat(newExpense.amount_usd))}` : '—'}
                                    </span>
                                </div>
                            </div>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Referencia / Nro. Factura</span>
                                <input
                                    className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold text-sm text-slate-900 dark:text-white placeholder:text-slate-300"
                                    placeholder="OBSERVACIONES O NRO FACTURA"
                                    value={newExpense.reference}
                                    onChange={(e) => setNewExpense({ ...newExpense, reference: e.target.value.toUpperCase() })}
                                />
                            </label>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-3">
                            <button
                                onClick={() => setShowExpenseModal(false)}
                                className="flex-1 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-none font-bold text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:border-slate-900 dark:hover:border-white transition-colors"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleRegisterExpense}
                                className="flex-1 py-3 bg-red-600 text-white rounded-none font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors border border-transparent shadow-lg shadow-red-200"
                            >
                                REGISTRAR EGRESO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpecialQuotas;

