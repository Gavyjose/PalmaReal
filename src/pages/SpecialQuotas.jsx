import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/formatters';
import { sortUnits } from '../utils/unitSort';
import { usePaymentOcr } from '../hooks/usePaymentOcr';

const fetchSpecialQuotasData = async ([_, selectedTower]) => {
    if (!selectedTower) return null;

    // 1. Fetch units
    const { data: unitsData } = await supabase
        .from('units')
        .select(`id, number, floor, tower, owners!inner (full_name)`)
        .eq('tower', selectedTower);

    const sortedUnits = sortUnits(unitsData || []);

    // 2. Fetch active project
    const { data: projData } = await supabase
        .from('special_quota_projects')
        .select('*')
        .eq('tower_id', selectedTower)
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();

    // 3. Fetch closed projects (history)
    const { data: closedProjects } = await supabase
        .from('special_quota_projects')
        .select('*')
        .eq('tower_id', selectedTower)
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: false });

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
        expenses: finalExpenses,
        closedProjects: closedProjects || []
    };
};

const SpecialQuotas = () => {
    const { userRole } = useAuth();
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
    const closedProjects = data?.closedProjects || [];

    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
    const [isMutating, setIsMutating] = useState(false);
    const [expandedUnitId, setExpandedUnitId] = useState(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);
    const [historyData, setHistoryData] = useState({});

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
    const [editingExpenseId, setEditingExpenseId] = useState(null);
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

    const {
        file,
        previewUrl,
        ocrProcessing,
        ocrValidation,
        handleFileChange,
        resetOcr,
        uploadReceipt
    } = usePaymentOcr(paymentDetails.reference);

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

        if (ocrValidation && !ocrValidation.match) {
            if (!confirm('Los últimos 6 dígitos de la referencia no coinciden con la captura. ¿Deseas asentar de todos modos?')) return;
        }

        try {
            setIsMutating(true);

            let receiptUrl = await uploadReceipt('payment-captures', 'special-quotas');

            const { error } = await supabase
                .from('special_quota_payments')
                .insert([{
                    project_id: project.id,
                    unit_id: selectedUnitForPayment.id,
                    installment_number: parseInt(paymentDetails.installment_number),
                    amount: parseFloat(paymentDetails.amount),
                    reference: paymentDetails.reference.toUpperCase(),
                    payment_date: paymentDetails.payment_date,
                    receipt_url: receiptUrl
                }]);

            if (error) throw error;

            alert('✅ Pago registrado exitosamente.');
            setShowPaymentModal(false);
            resetOcr();
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
            const expenseData = {
                project_id: project.id,
                description: newExpense.description.toUpperCase(),
                category: newExpense.category,
                amount_bs: amountBs,
                bcv_rate: newExpense.bcv_rate,
                amount_usd: parseFloat(amountUsd.toFixed(2)),
                date: newExpense.date,
                reference: newExpense.reference ? newExpense.reference.toUpperCase() : null
            };

            if (editingExpenseId) {
                const { error } = await supabase
                    .from('special_quota_expenses')
                    .update(expenseData)
                    .eq('id', editingExpenseId);
                if (error) throw error;
                alert('✅ Egreso actualizado exitosamente.');
            } else {
                const { error } = await supabase
                    .from('special_quota_expenses')
                    .insert([expenseData]);
                if (error) throw error;
                alert('✅ Egreso registrado exitosamente.');
            }

            setShowExpenseModal(false);
            setEditingExpenseId(null);
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
            console.error('Error registering/updating expense:', error);
            alert('Error al procesar egreso: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este egreso? Esta acción no se puede deshacer.')) return;

        try {
            setIsMutating(true);
            const { error } = await supabase
                .from('special_quota_expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;

            alert('✅ Egreso eliminado correctamente.');
            mutateData();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Error al eliminar egreso: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const openEditModal = (exp) => {
        setEditingExpenseId(exp.id);
        setNewExpense({
            description: exp.description,
            category: exp.category,
            amount_bs: exp.amount_bs || '',
            bcv_rate: exp.bcv_rate || 0,
            amount_usd: exp.amount_usd || '',
            date: exp.date,
            reference: exp.reference || ''
        });
        setShowExpenseModal(true);
    };

    const handleCloseProject = async () => {
        if (!project) return;
        try {
            setIsMutating(true);
            const { error } = await supabase
                .from('special_quota_projects')
                .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
                .eq('id', project.id);
            if (error) throw error;
            setShowCloseConfirmModal(false);
            mutateData();
        } catch (error) {
            console.error('Error closing project:', error);
            alert('Error al cerrar el proyecto: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const fetchHistoryExpanded = async (projId) => {
        if (historyData[projId]) return; // already loaded
        const [{ data: pays }, { data: exps }] = await Promise.all([
            supabase.from('special_quota_payments').select('*').eq('project_id', projId),
            supabase.from('special_quota_expenses').select('*').eq('project_id', projId).order('date', { ascending: false })
        ]);
        setHistoryData(prev => ({ ...prev, [projId]: { payments: pays || [], expenses: exps || [] } }));
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
        <div className="flex flex-col flex-1 max-w-[1600px] mx-auto w-full p-4 lg:p-8 gap-8 min-h-screen animate-fade-in text-slate-800 dark:text-slate-100">
            {/* Page Header - Premium Glassmorphism */}
            <div className="relative group p-8 rounded-[2.5rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden active-premium-card transition-all duration-700">
                {/* Decorative Background Elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/15 transition-all duration-700"></div>

                <div className="relative flex flex-wrap justify-between items-center gap-8">
                    <div className="flex flex-col gap-2">
                        <nav className="flex items-center gap-3 text-[10px] font-display-bold uppercase tracking-[0.2em] text-emerald-600/70 dark:text-emerald-400/70 mb-1">
                            <span className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">Finanzas</span>
                            <span className="opacity-30">/</span>
                            <span className="text-slate-900 dark:text-white">Gestión de Cuotas</span>
                        </nav>
                        <h1 className="text-4xl font-display-black text-slate-900 dark:text-white uppercase tracking-tight leading-none bg-gradient-to-r from-slate-900 via-emerald-800 to-slate-900 dark:from-white dark:via-emerald-400 dark:to-white bg-clip-text text-transparent">
                            Presupuestos & <span className="text-emerald-600 dark:text-emerald-500 italic">Cuotas Especiales</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-display-medium mt-1">Seguimiento financiero de alta precisión para proyectos extraordinarios.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Tower Selector - Glass Style */}
                        <div className="flex flex-col gap-1.5 min-w-[140px]">
                            <span className="text-[10px] font-display-black uppercase tracking-widest text-slate-500 pl-1 dark:text-slate-400/60">Bloque Activo</span>
                            <div className="relative">
                                <select
                                    value={selectedTower}
                                    onChange={(e) => {
                                        setLocalSelectedTower(e.target.value);
                                        setLastSelectedTower(e.target.value);
                                    }}
                                    className="w-full appearance-none bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-2xl px-5 py-3.5 font-display-bold text-sm uppercase tracking-wider text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xl pr-12 transition-all"
                                >
                                    {activeTowers.map(t => <option key={t.name} value={t.name}>Torre {t.name}</option>)}
                                </select>
                                <span className="material-icons absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">expand_more</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-end gap-3 h-full pt-4">
                            <button className="h-[54px] px-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-2xl text-slate-700 dark:text-slate-300 text-xs font-display-bold uppercase tracking-widest flex items-center gap-3 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-xl active:scale-95 group">
                                <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                    <span className="material-icons text-sm">download</span>
                                </div>
                                <span>Exportar</span>
                            </button>

                            {userRole !== 'VISOR' && (
                                <>
                                    {project && (
                                        <>
                                            <button
                                                onClick={() => setShowExpenseModal(true)}
                                                className="h-[54px] px-6 bg-rose-500/10 dark:bg-rose-500/5 backdrop-blur-md border border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-display-bold uppercase tracking-widest flex items-center gap-3 hover:bg-rose-500 hover:text-white transition-all shadow-xl active:scale-95 group"
                                            >
                                                <div className="p-2 bg-rose-500/20 rounded-xl group-hover:bg-white group-hover:text-rose-500 transition-all">
                                                    <span className="material-icons text-sm">payments</span>
                                                </div>
                                                <span>Gasto</span>
                                            </button>
                                            <button
                                                onClick={() => setShowCloseConfirmModal(true)}
                                                className="h-[54px] px-6 bg-slate-500/10 dark:bg-slate-500/10 backdrop-blur-md border border-slate-400/30 rounded-2xl text-slate-600 dark:text-slate-300 text-xs font-display-bold uppercase tracking-widest flex items-center gap-3 hover:bg-slate-600 hover:text-white transition-all shadow-xl active:scale-95 group"
                                            >
                                                <div className="p-2 bg-slate-400/20 rounded-xl group-hover:bg-white group-hover:text-slate-600 transition-all">
                                                    <span className="material-icons text-sm">archive</span>
                                                </div>
                                                <span>Cerrar</span>
                                            </button>
                                        </>
                                    )}

                                    {project ? (
                                        <button
                                            onClick={() => setShowPaymentModal(true)}
                                            className="h-[54px] px-8 bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-2xl text-xs font-display-bold uppercase tracking-[0.15em] flex items-center gap-3 shadow-[0_10px_30px_rgba(5,150,105,0.3)] hover:shadow-[0_15px_35px_rgba(5,150,105,0.4)] transition-all active:scale-95 group"
                                        >
                                            <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-90 transition-all duration-500">
                                                <span className="material-icons text-sm">add_circle</span>
                                            </div>
                                            <span>Abonar Cuota</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setShowProjectModal(true)}
                                            className="h-[54px] px-8 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl text-xs font-display-bold uppercase tracking-[0.15em] flex items-center gap-3 shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:shadow-[0_15px_35px_rgba(37,99,235,0.4)] transition-all active:scale-95 group"
                                        >
                                            <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-all">
                                                <span className="material-icons text-sm">rocket_launch</span>
                                            </div>
                                            <span>Lanzar Proyecto</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
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
                    {userRole !== 'VISOR' && (
                        <button
                            onClick={() => setShowProjectModal(true)}
                            className="px-8 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-none font-bold uppercase tracking-widest text-xs hover:invert transition-all flex items-center gap-2 border-2 border-transparent"
                        >
                            <span className="material-icons text-sm">add</span> Asignar Presupuesto
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Configuration & KPIs - Social VIVO Style */}
                    <section className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        {/* Config Panel - Tech Desglose */}
                        <div className="xl:col-span-1 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group active-premium-card">
                            <h3 className="text-lg font-display-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 flex items-center gap-3">
                                <span className="p-1.5 bg-emerald-500 rounded-lg text-white material-icons text-xs">tune</span>
                                Desglose Técnico
                            </h3>
                            <div className="space-y-6 relative z-10">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-display-black uppercase tracking-[0.1em] text-slate-400 pl-1">Presupuesto Referencial</span>
                                    <div className="relative group/input">
                                        <div className="absolute inset-x-0 h-full bg-emerald-500/5 rounded-2xl group-hover/input:bg-emerald-500/10 transition-all"></div>
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-display-bold text-xl">$</span>
                                        <input
                                            className="w-full pl-10 pr-4 py-4 bg-transparent border-b-2 border-emerald-500/20 text-slate-900 dark:text-white font-display-bold text-2xl outline-none focus:border-emerald-500 transition-all"
                                            type="text"
                                            value={formatNumber(project.total_budget)}
                                            readOnly
                                        />
                                    </div>
                                </label>
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-display-black uppercase tracking-[0.1em] text-slate-400 pl-1">Estructura de Cuota</span>
                                    <div className="px-5 py-4 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/20 dark:border-white/5 font-display-bold text-lg text-slate-900 dark:text-emerald-400 flex items-center justify-between">
                                        <span>{project.installments_count} PARTES</span>
                                        <span className="text-xs font-display-medium text-slate-400">(Tranches)</span>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col gap-3 font-display-medium text-xs">
                                    <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                        <span>Denominación:</span>
                                        <span className="font-display-bold text-slate-900 dark:text-white uppercase truncate max-w-[140px]">{project.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                        <span>Estado Operativo:</span>
                                        <span className="px-2 py-1 bg-emerald-500 text-white text-[9px] font-display-black uppercase tracking-widest rounded-md">{project.status}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KPI Cards Container */}
                        <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {/* Card 1: Recaudación */}
                            <div className="relative group p-8 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-[2.5rem] border border-emerald-500/20 shadow-xl overflow-hidden active-premium-card">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
                                    <span className="material-icons text-7xl text-emerald-600">savings</span>
                                </div>
                                <div className="relative flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/40 text-white flex items-center justify-center">
                                            <span className="material-icons text-base">account_balance_wallet</span>
                                        </div>
                                        <div className="py-1 px-3 bg-emerald-500 text-white text-[10px] font-display-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20">
                                            {progressPercent.toFixed(1)}% RECAUDADO
                                        </div>
                                    </div>
                                    <div className="mt-8">
                                        <p className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] mb-1">Volumen Recolectado</p>
                                        <p className="text-4xl font-display-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">${formatNumber(totalCollected)}</p>
                                        <div className="flex items-center gap-2 mt-3 p-2 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-white/20">
                                            <span className="material-icons text-xs text-emerald-500">payments</span>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-display-bold uppercase tracking-widest">Efectivo: ${formatNumber(totalCollectedCashUSD)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Ejecución */}
                            <div className="relative group p-8 bg-gradient-to-br from-rose-500/5 to-orange-500/5 rounded-[2.5rem] border border-rose-500/20 shadow-xl overflow-hidden active-premium-card">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
                                    <span className="material-icons text-7xl text-rose-600">engineering</span>
                                </div>
                                <div className="relative flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 bg-rose-500 rounded-2xl shadow-lg shadow-rose-500/40 text-white flex items-center justify-center">
                                            <span className="material-icons text-base">shopping_cart</span>
                                        </div>
                                        <div className="py-1 px-3 bg-rose-500 text-white text-[10px] font-display-black uppercase tracking-widest rounded-full shadow-lg shadow-rose-500/20">
                                            {executionPercent.toFixed(1)}% EJECUTADO
                                        </div>
                                    </div>
                                    <div className="mt-8">
                                        <p className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] mb-1">Inversión Realizada</p>
                                        <p className="text-4xl font-display-black text-rose-600 dark:text-rose-400 tracking-tight leading-none">${formatNumber(totalExecuted)}</p>
                                        <div className="flex gap-2 mt-3">
                                            <div className="px-2 py-1 bg-white/40 dark:bg-slate-800/40 rounded-lg border border-white/20 text-[8px] font-display-bold uppercase tracking-widest text-slate-500">MAT: ${formatNumber(totalExecutedMaterials)}</div>
                                            <div className="px-2 py-1 bg-white/40 dark:bg-slate-800/40 rounded-lg border border-white/20 text-[8px] font-display-bold uppercase tracking-widest text-slate-500">M.O: ${formatNumber(totalExecutedLabor)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Saldo Social Board */}
                            <div className="relative group p-8 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-950 rounded-[2.5rem] shadow-2xl overflow-hidden active-premium-card border-t-4 border-emerald-500">
                                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                                <div className="relative flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 bg-white/10 rounded-2xl text-white flex items-center justify-center">
                                            <span className="material-icons text-base">account_balance</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-display-black uppercase tracking-widest ${currentCashBalance >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500 text-white'}`}>
                                            {currentCashBalance >= 0 ? 'LIQUIDEZ ALTA' : 'DÉFICIT'}
                                        </span>
                                    </div>
                                    <div className="mt-8">
                                        <p className="text-[10px] font-display-black text-slate-400 uppercase tracking-[0.2em] mb-1">Disponibilidad en Caja</p>
                                        <div className="flex items-baseline gap-2">
                                            <p className={`text-4xl font-display-black tracking-tight leading-none ${currentCashBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                                                ${formatNumber(Math.abs(currentCashBalance))}
                                            </p>
                                            {currentCashBalance < 0 && <span className="text-[10px] font-display-black text-rose-500 uppercase tracking-widest animate-pulse">OVERDRAWN</span>}
                                        </div>
                                        <p className="text-[9px] text-slate-500 font-display-medium mt-3 leading-relaxed">Fondos auditados disponibles para asignación inmediata en obra.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Integrated Special Quotas Ledger - Social Board Aesthetic */}
                    <section className="flex flex-col gap-6 mb-20 animate-fade-in">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-8 bg-emerald-500 rounded-full"></div>
                                <h2 className="text-2xl font-display-black uppercase tracking-tight text-slate-900 dark:text-white">
                                    Control de Cobranza <span className="text-emerald-500">Torre {selectedTower}</span>
                                </h2>
                                {project && userRole !== 'VISOR' && (
                                    <button
                                        onClick={handleRepairData}
                                        className="ml-4 px-4 py-1.5 text-[9px] font-display-black uppercase tracking-widest border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all rounded-lg active:scale-95 flex items-center gap-2"
                                    >
                                        <span className="material-icons text-[10px]">sync</span>
                                        Sincronizar Auditoría
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-6">
                                <span className="flex items-center gap-2 text-[10px] font-display-black text-slate-400 uppercase tracking-widest">
                                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div> Total Pagado
                                </span>
                                <span className="flex items-center gap-2 text-[10px] font-display-black text-slate-400 uppercase tracking-widest">
                                    <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div> Pendiente
                                </span>
                            </div>
                        </div>

                        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl max-h-[700px] relative group/table active-premium-card">
                            {/* Header row - Sticky & Premium */}
                            <div className="grid grid-cols-12 gap-4 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-b border-white/20 dark:border-white/5 px-10 py-6 sticky top-0 z-30 shadow-sm">
                                <div className="col-span-3 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400">Unidad Mobiliaria</div>
                                <div className="col-span-4 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400">Titular / Razón Social</div>
                                <div className="col-span-2 text-[10px] font-display-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 text-right">Recaudado ($)</div>
                                <div className="col-span-2 text-[10px] font-display-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400 text-right">Pendiente ($)</div>
                                <div className="col-span-1 text-center text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400">Audit</div>
                            </div>

                            {/* Body - Virtualized style scroll */}
                            <div className="flex flex-col divide-y divide-white/10 dark:divide-white/5 overflow-y-auto custom-scrollbar-thin">
                                {units.map((unit) => {
                                    const unitPayments = payments.filter(p => p.unit_id === unit.id);
                                    const unitPaidAmount = unitPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                                    const unitDebtAmount = quotaPerUnit - unitPaidAmount;
                                    const isExpanded = expandedUnitId === unit.id;

                                    return (
                                        <div key={unit.id} className="flex flex-col group/row transition-all duration-300">
                                            {/* Main Row */}
                                            <div
                                                className={`grid grid-cols-12 gap-4 px-10 py-5 items-center cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : 'hover:bg-white/60 dark:hover:bg-white/5'}`}
                                                onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                                            >
                                                <div className="col-span-3 flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display-black text-sm transition-all shadow-lg ${isExpanded ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white group-hover/row:bg-emerald-500 group-hover/row:text-white'}`}>
                                                        {unit.number}
                                                    </div>
                                                    <span className="font-display-black text-slate-900 dark:text-white text-base">U-{unit.number}</span>
                                                </div>
                                                <div className="col-span-4 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-display-black text-slate-500 group-hover/row:bg-emerald-500 group-hover/row:text-white transition-all">
                                                        {unit.owners?.full_name?.charAt(0) || '?'}
                                                    </div>
                                                    <span className="font-display-bold text-sm text-slate-700 dark:text-slate-300 uppercase truncate max-w-[220px]">{unit.owners?.full_name || '--'}</span>
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-display-black text-lg ${unitPaidAmount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700'}`}>
                                                            ${formatNumber(unitPaidAmount)}
                                                        </span>
                                                        {unitPaidAmount > 0 && <span className="text-[9px] font-display-black text-emerald-500/60 uppercase tracking-widest mt-[-2px]">Validado</span>}
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-display-black text-lg ${unitDebtAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-slate-700'}`}>
                                                            ${formatNumber(unitDebtAmount)}
                                                        </span>
                                                        {unitDebtAmount > 0 && <span className="text-[9px] font-display-black text-rose-500/60 uppercase tracking-widest mt-[-2px]">Pendiente</span>}
                                                    </div>
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-emerald-500 text-white rotate-180' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover/row:text-emerald-500'}`}>
                                                        <span className="material-icons text-lg">expand_more</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Audit Log - Premium Detail */}
                                            {isExpanded && (
                                                <div className="border-t border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/5 p-10 shadow-inner animate-slide-up flex flex-col xl:flex-row gap-12 relative overflow-hidden">
                                                    {/* Decorative background for detail */}
                                                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>

                                                    {/* Installments Visualizer */}
                                                    <div className="flex flex-col gap-6 min-w-[280px] relative z-10">
                                                        <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-4">
                                                            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                                                                <span className="material-icons text-sm">segment</span>
                                                            </div>
                                                            <span className="text-xs font-display-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Liquidación de Tramos</span>
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-4">
                                                            {[...Array(project.installments_count)].map((_, i) => {
                                                                const isPaidInst = isPaid(unit.id, i + 1);
                                                                return (
                                                                    <div key={i} className="flex flex-col gap-2 items-center">
                                                                        <span className="text-[10px] font-display-black text-slate-400">#{i + 1}</span>
                                                                        {isPaidInst ? (
                                                                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-110" title="Tramo Pagado">
                                                                                <span className="material-icons text-xl">check_circle</span>
                                                                            </div>
                                                                        ) : userRole !== 'VISOR' ? (
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
                                                                                className="w-12 h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-500 transition-all rounded-2xl flex items-center justify-center group/btn active:scale-95 shadow-sm"
                                                                                title="Liquidar Tramo"
                                                                            >
                                                                                <span className="material-icons text-xl text-slate-300 group-hover/btn:text-emerald-500 transition-all">add_circle_outline</span>
                                                                            </button>
                                                                        ) : (
                                                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 flex items-center justify-center rounded-2xl">
                                                                                <span className="material-icons text-xl">lock</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mt-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/40 dark:border-white/5 backdrop-blur-md">
                                                            <p className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest mb-1">Monto por Tramo</p>
                                                            <p className="text-xl font-display-black text-slate-900 dark:text-white">${formatNumber(amountPerInstallment)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Ledger Table */}
                                                    <div className="flex flex-col gap-6 flex-1 relative z-10">
                                                        <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-4">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900">
                                                                <span className="material-icons text-sm">history_edu</span>
                                                            </div>
                                                            <span className="text-xs font-display-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Libro Mayor Transaccional (Unidad {unit.number})</span>
                                                        </div>
                                                        {unitPayments.length === 0 ? (
                                                            <div className="flex flex-col items-center justify-center py-10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40">
                                                                <span className="material-icons text-4xl text-slate-300 mb-3">payments</span>
                                                                <p className="text-xs font-display-bold text-slate-400 uppercase tracking-widest">No hay registros de abono</p>
                                                            </div>
                                                        ) : (
                                                            <div className="overflow-hidden rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl">
                                                                <table className="w-full text-left bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
                                                                    <thead className="bg-slate-900 dark:bg-slate-950 text-white">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-[9px] font-display-black uppercase tracking-widest">Fecha</th>
                                                                            <th className="px-6 py-4 text-[9px] font-display-black uppercase tracking-widest text-right">Importe USD</th>
                                                                            <th className="px-6 py-4 text-[9px] font-display-black uppercase tracking-widest">Referencia / Traza</th>
                                                                            <th className="px-6 py-4 text-[9px] font-display-black uppercase tracking-widest text-center">Asignación</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                        {unitPayments.map(p => (
                                                                            <tr key={p.id} className="hover:bg-emerald-500/5 transition-all">
                                                                                <td className="px-6 py-4">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-xs font-display-bold text-slate-700 dark:text-slate-300">
                                                                                            {new Date(p.payment_date).toLocaleDateString('es-VE')}
                                                                                        </span>
                                                                                        <span className="text-[9px] font-display-black text-slate-400 uppercase">Procesado</span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-right">
                                                                                    <span className="text-sm font-display-black text-emerald-600 dark:text-emerald-400">
                                                                                        ${formatNumber(p.amount)}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-6 py-4">
                                                                                    <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-display-black text-slate-500 uppercase tracking-wider inline-block">
                                                                                        {p.reference || '--'}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-center">
                                                                                    <div className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-display-black uppercase tracking-[0.15em] rounded-md shadow-lg shadow-emerald-500/10 inline-block">
                                                                                        TRAMO {p.installment_number}
                                                                                    </div>
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

                            {/* Footer Summary - Premium Sticky */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-900 dark:bg-slate-950 border-t-4 border-emerald-500 px-12 py-8 items-center sticky bottom-0 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                                <div className="flex items-center gap-10">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-display-black uppercase text-emerald-500 tracking-[0.25em] mb-1">Métrica Recopilada</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-display-black text-white">${formatNumber(totalCollected)}</span>
                                            <span className="text-xs font-display-bold text-slate-500 uppercase">USD TOTAL</span>
                                        </div>
                                    </div>
                                    <div className="h-12 w-[1px] bg-white/10"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-display-black uppercase text-slate-500 tracking-[0.25em] mb-1">Caja Efectivo</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-display-black text-emerald-400/90">${formatNumber(totalCollectedCashUSD)}</span>
                                            <span className="text-[9px] font-display-black text-slate-500 uppercase tracking-widest">In-Caja</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-12">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-display-black uppercase text-rose-500 tracking-[0.25em] mb-1">Diferencial Moroso</span>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-3xl font-display-black text-rose-500">${formatNumber(remainingBudget)}</span>
                                            <div className="p-1.5 bg-rose-500 rounded-lg text-white material-icons text-xs">trending_down</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Expenses Relationship Section - Social Board Aesthetic */}
                    <section className="flex flex-col gap-6 animate-fade-in mb-20 px-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-8 bg-rose-500 rounded-full"></div>
                                <h2 className="text-2xl font-display-black uppercase tracking-tight text-slate-900 dark:text-white">
                                    Relación de Ejecución <span className="text-rose-500">(Egresos)</span>
                                </h2>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                    <span className="text-[10px] font-display-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Materiales:</span>
                                    <span className="text-sm font-display-black text-slate-900 dark:text-white">${formatNumber(totalExecutedMaterials)}</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                    <span className="text-[10px] font-display-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Mano de Obra:</span>
                                    <span className="text-sm font-display-black text-slate-900 dark:text-white">${formatNumber(totalExecutedLabor)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl relative group/table active-premium-card">
                            <div className="grid grid-cols-12 gap-4 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-b border-white/20 dark:border-white/5 px-10 py-6 sticky top-0 z-10">
                                <div className="col-span-2 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400">Fecha</div>
                                <div className="col-span-3 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400">Descripción / Concepto</div>
                                <div className="col-span-2 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400 text-center">Categoría</div>
                                <div className="col-span-2 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400 text-right">Importe USD</div>
                                <div className="col-span-1 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400 text-right">Referencia</div>
                                <div className="col-span-2 text-[10px] font-display-black uppercase tracking-[0.2em] text-slate-400 text-center">Acciones</div>
                            </div>
                            <div className="flex flex-col divide-y divide-white/10 dark:divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar-thin">
                                {projectExpenses.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                        <span className="material-icons text-5xl mb-4">inventory_2</span>
                                        <p className="text-sm font-display-bold uppercase tracking-[0.2em]">Sin registros de ejecución</p>
                                    </div>
                                ) : (
                                    projectExpenses.map((exp) => (
                                        <div key={exp.id} className="grid grid-cols-12 gap-4 px-10 py-5 items-center hover:bg-white/60 dark:hover:bg-white/5 transition-all duration-300 group/row">
                                            <div className="col-span-2">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-display-bold text-slate-500">{exp.date}</span>
                                                    <span className="text-[9px] font-display-black text-rose-500/60 uppercase tracking-widest mt-0.5">Egreso</span>
                                                </div>
                                            </div>
                                            <div className="col-span-3">
                                                <span className="font-display-bold text-sm text-slate-900 dark:text-white uppercase leading-tight">{exp.description}</span>
                                            </div>
                                            <div className="col-span-2 flex justify-center">
                                                <span className={`px-4 py-1.5 text-[9px] font-display-black uppercase tracking-[0.15em] rounded-full shadow-lg border-2 ${exp.category === 'MATERIALES' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 shadow-blue-500/5' :
                                                    exp.category === 'MANO DE OBRA' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20 shadow-purple-500/5' :
                                                        'bg-slate-500/10 text-slate-600 border-slate-500/20 shadow-slate-500/5'
                                                    }`}>
                                                    {exp.category}
                                                </span>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-base font-display-black text-rose-600 dark:text-rose-400">${formatNumber(exp.amount_usd)}</span>
                                                    <span className="text-[9px] font-display-black text-slate-400 uppercase tracking-tighter">Bs. {formatNumber(exp.amount_bs)} · @{formatNumber(exp.bcv_rate)}</span>
                                                </div>
                                            </div>
                                            <div className="col-span-1 text-right">
                                                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-display-black text-slate-500 uppercase tracking-wider inline-block">
                                                    {exp.reference || '--'}
                                                </div>
                                            </div>
                                            <div className="col-span-2 flex justify-center gap-2">
                                                {userRole !== 'VISOR' ? (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(exp)}
                                                            className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-300 flex items-center justify-center shadow-lg shadow-emerald-500/5"
                                                            title="Editar Egreso"
                                                        >
                                                            <span className="material-icons text-sm">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteExpense(exp.id)}
                                                            className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white transition-all duration-300 flex items-center justify-center shadow-lg shadow-rose-500/5"
                                                            title="Eliminar Egreso"
                                                        >
                                                            <span className="material-icons text-sm">delete</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center">
                                                        <span className="material-icons text-sm">lock</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {projectExpenses.length > 0 && (
                                <div className="bg-slate-900 dark:bg-slate-950 border-t-4 border-rose-500 px-12 py-8 flex justify-between items-center sticky bottom-0 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-display-black uppercase text-rose-500 tracking-[0.25em] mb-1">Inversión Ejecutada</span>
                                        <p className="text-[9px] text-slate-500 font-display-medium uppercase max-w-[200px]">Total de capital amortizado en mano de obra y suministros</p>
                                    </div>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-4xl font-display-black text-white">${formatNumber(totalExecuted)}</span>
                                        <span className="text-xs font-display-bold text-rose-500 uppercase">USD TOTAL</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {/* Modal: Nuevo Proyecto - Social VIVO Premium */}
            {showProjectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-xl animate-fade-in">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up relative active-premium-card font-display">
                        {/* Decorative header blur */}
                        <div className="absolute top-0 inset-x-0 h-32 bg-emerald-500/10 blur-3xl -z-10"></div>

                        <div className="p-10 border-b border-slate-200 dark:border-slate-800/50">
                            <div className="flex items-center gap-5 mb-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                                    <span className="material-icons text-3xl">rocket_launch</span>
                                </div>
                                <div>
                                    <h3 className="text-3xl font-display-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Nueva Iniciativa</h3>
                                    <p className="text-xs font-display-medium text-emerald-500 uppercase tracking-widest mt-1">Planificación de Capital Torre {selectedTower}</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-display-medium leading-relaxed">
                                Formule un nuevo requerimiento presupuestario para la comunidad. Los fondos serán prorrateados según el número de tramos definido.
                            </p>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Designación del Proyecto</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500 material-icons">assignment</span>
                                    <input
                                        className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-display-bold text-base text-slate-900 dark:text-white transition-all placeholder:text-slate-300"
                                        placeholder="EJ: MODERNIZACIÓN DE ASCENSORES"
                                        value={newProject.name}
                                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Inversión (USD)</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-display-black text-emerald-500">$</span>
                                        <input
                                            type="number"
                                            className="w-full pl-10 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-display-black text-xl text-slate-900 dark:text-white transition-all"
                                            placeholder="0,00"
                                            value={newProject.total_budget}
                                            onChange={(e) => setNewProject({ ...newProject, total_budget: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Amortización / Tramos</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 material-icons text-sm">segment</span>
                                        <select
                                            className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-display-bold text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
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
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-200 dark:border-slate-800/50 flex gap-4">
                            <button
                                onClick={() => setShowProjectModal(false)}
                                className="flex-1 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-display-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-900/20 transition-all active:scale-95"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleCreateProject}
                                className="flex-[2] py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all active:scale-95"
                            >
                                LANZAR PROYECTO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Registrar Pago (Liquidación) - Social VIVO Premium */}
            {showPaymentModal && project && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-xl animate-fade-in">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up relative active-premium-card font-display">

                        <div className="p-10 border-b border-slate-200 dark:border-slate-800/50">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                        <span className="material-icons">receipt_long</span>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-display-black text-slate-900 dark:text-white uppercase tracking-tight">Liquidación</h3>
                                        <p className="text-[10px] font-display-black text-emerald-500 uppercase tracking-widest">Abono a Cuota Especial</p>
                                    </div>
                                </div>
                                <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Tramo</span>
                                    <span className="text-sm font-display-black text-slate-900 dark:text-white uppercase">NIVEL {paymentDetails.installment_number}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                    <span className="material-icons text-sm">home</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-display-black text-slate-400 uppercase tracking-widest">Unidad Beneficiaria</span>
                                    <span className="text-sm font-display-bold text-slate-900 dark:text-white">
                                        {selectedUnitForPayment ? `U-${selectedUnitForPayment.number} · ${selectedUnitForPayment.owners?.full_name}` : 'Pendiente de Selección'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Fecha Valor</label>
                                    <input
                                        type="date"
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-emerald-500 font-display-bold text-sm text-slate-900 dark:text-white transition-all"
                                        value={paymentDetails.payment_date}
                                        onChange={(e) => setPaymentDetails({ ...paymentDetails, payment_date: e.target.value })}
                                    />
                                </div>
                                {!selectedUnitForPayment && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Unidad</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-emerald-500 font-display-bold text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                                            onChange={(e) => setSelectedUnitForPayment(units.find(u => u.id === e.target.value))}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {units.map(u => <option key={u.id} value={u.id}>U-{u.number}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-[1.5rem] border border-slate-200 dark:border-slate-700/30">
                                <button
                                    onClick={() => setPaymentDetails({ ...paymentDetails, payment_method: 'TRANSFER' })}
                                    className={`flex-1 py-4 px-2 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 ${paymentDetails.payment_method === 'TRANSFER'
                                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xl shadow-black/5 border border-slate-200 dark:border-slate-600'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                >
                                    <span className="material-icons text-lg">account_balance</span>
                                    <span className="text-[10px] font-display-black uppercase tracking-widest">Transferencia</span>
                                </button>
                                <button
                                    onClick={() => setPaymentDetails({ ...paymentDetails, payment_method: 'CASH' })}
                                    className={`flex-1 py-4 px-2 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 ${paymentDetails.payment_method === 'CASH'
                                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xl shadow-black/5 border border-slate-200 dark:border-slate-600'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                >
                                    <span className="material-icons text-lg">payments</span>
                                    <span className="text-[10px] font-display-black uppercase tracking-widest">Efectivo</span>
                                </button>
                            </div>

                            <div className="space-y-6">
                                {paymentDetails.payment_method === 'TRANSFER' && (
                                    <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 dark:bg-slate-950/20 rounded-3xl border border-slate-200 dark:border-slate-800 animate-slide-up">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest ml-2">Monto Bs.</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-display-bold text-xs uppercase">Bs.</span>
                                                <input
                                                    className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-emerald-500 font-display-black text-xl text-slate-900 dark:text-white"
                                                    type="number"
                                                    value={paymentDetails.amount_bs}
                                                    onChange={(e) => {
                                                        const bs = e.target.value;
                                                        const usd = paymentDetails.bcv_rate > 0 ? (parseFloat(bs) / paymentDetails.bcv_rate).toFixed(2) : paymentDetails.amount;
                                                        setPaymentDetails({ ...paymentDetails, amount_bs: bs, amount: usd });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest ml-2">Tasa BCV</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-emerald-500 font-display-black text-xl text-emerald-600 dark:text-emerald-400"
                                                    value={paymentDetails.bcv_rate}
                                                    onChange={(e) => setPaymentDetails({ ...paymentDetails, bcv_rate: e.target.value })}
                                                />
                                                {loadingRate && <span className="absolute right-4 top-1/2 -translate-y-1/2 material-icons text-xs animate-spin text-slate-400">sync</span>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-display-black tracking-[0.2em] text-emerald-600 dark:text-emerald-400 uppercase ml-2">
                                        {paymentDetails.payment_method === 'CASH' ? 'Importe Recibido (USD)' : 'Convertido a Divisa (USD)'}
                                    </label>
                                    <div className="relative group/input">
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-display-black text-2xl text-emerald-500">$</span>
                                        <input
                                            className={`w-full pl-12 pr-6 py-6 bg-emerald-500/5 border-2 rounded-3xl focus:outline-none font-display-black text-3xl transition-all ${paymentDetails.payment_method === 'CASH' ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200 dark:border-slate-700'
                                                } text-emerald-600 dark:text-emerald-400`}
                                            type="number"
                                            value={paymentDetails.amount}
                                            onChange={(e) => setPaymentDetails({ ...paymentDetails, amount: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {paymentDetails.payment_method === 'TRANSFER' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Evidencia de Pago</label>
                                        <div className="relative group/capture">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="hidden"
                                                id="special-capture-upload"
                                            />
                                            <label
                                                htmlFor="special-capture-upload"
                                                className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-6 transition-all cursor-pointer ${previewUrl ? 'border-emerald-500 bg-emerald-500/5 shadow-inner shadow-emerald-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-500/5'}`}
                                            >
                                                {previewUrl ? (
                                                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl">
                                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-emerald-950/40 flex items-center justify-center opacity-0 group-hover/capture:opacity-100 transition-opacity">
                                                            <span className="text-white text-[10px] font-display-black uppercase tracking-widest">Cambiar Captura</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 group-hover/capture:scale-110 transition-transform">
                                                            <span className="material-icons text-xl text-slate-400">upload_file</span>
                                                        </div>
                                                        <span className="text-[10px] font-display-black text-slate-400 uppercase tracking-widest mt-3">Subir Referencia Visual</span>
                                                    </>
                                                )}
                                            </label>

                                            {ocrProcessing && (
                                                <div className="absolute top-4 right-4 bg-white/95 dark:bg-slate-900/95 px-3 py-2 rounded-xl border border-emerald-500/20 shadow-xl flex items-center gap-2 animate-in fade-in zoom-in">
                                                    <div className="w-3 h-3 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                                                    <span className="text-[9px] font-display-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">OCR en Proceso</span>
                                                </div>
                                            )}

                                            {ocrValidation && !ocrProcessing && (
                                                <div className={`absolute top-4 right-4 px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-in zoom-in slide-in-from-top-2 border ${ocrValidation.match ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-rose-500 text-white border-rose-400'}`}>
                                                    <span className="material-icons text-sm">{ocrValidation.match ? 'check_circle' : 'error'}</span>
                                                    <span className="text-[9px] font-display-black uppercase tracking-widest leading-none">
                                                        {ocrValidation.match ? 'REF VALIDADA' : 'REF DESCONOCIDA'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-2">
                                        <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase">Referencia / Traza</label>
                                        {previewUrl && !ocrProcessing && ocrValidation && (
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-display-black uppercase tracking-widest animate-in slide-in-from-right-2 ${ocrValidation.match ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                                <span className="material-icons text-[10px]">{ocrValidation.match ? 'verified' : 'error'}</span>
                                                {ocrValidation.match ? 'Validada' : 'No Detectada'}
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl focus:outline-none font-display-bold text-sm text-slate-900 dark:text-white transition-all uppercase placeholder:text-slate-300 ${previewUrl && ocrValidation ? (ocrValidation.match ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-rose-500 ring-4 ring-rose-500/10') : 'border-slate-200 dark:border-slate-700/50 focus:border-emerald-500'}`}
                                        placeholder="PAGO MÓVIL / EFECTIVO / OTRO"
                                        value={paymentDetails.reference}
                                        onChange={(e) => setPaymentDetails({ ...paymentDetails, reference: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-200 dark:border-slate-800/50 flex gap-4">
                            <button
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setSelectedUnitForPayment(null);
                                }}
                                className="flex-1 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-display-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-900/20 transition-all active:scale-95"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleRegisterPayment}
                                className="flex-[2] py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all active:scale-95"
                            >
                                ASENTAR LIQUIDACIÓN
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Expense Registration Modal - Social VIVO Premium */}
            {showExpenseModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-xl animate-fade-in">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up relative active-premium-card font-display">

                        <div className="absolute top-0 inset-x-0 h-32 bg-rose-500/10 blur-3xl -z-10"></div>

                        <div className="p-10 border-b border-slate-200 dark:border-slate-800/50">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                                        <span className="material-icons">payments</span>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-display-black text-slate-900 dark:text-white uppercase tracking-tight">
                                            {editingExpenseId ? 'Editar Egreso' : 'Reportar Egreso'}
                                        </h3>
                                        <p className="text-[10px] font-display-black text-rose-500 uppercase tracking-widest">Liquidación del Capital Social</p>
                                    </div>
                                </div>
                                <button onClick={() => {
                                    setShowExpenseModal(false);
                                    setEditingExpenseId(null);
                                    setNewExpense({
                                        description: '',
                                        category: 'MATERIALES',
                                        amount_bs: '',
                                        bcv_rate: 0,
                                        amount_usd: '',
                                        date: new Date().toISOString().split('T')[0],
                                        reference: ''
                                    });
                                }} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                                    <span className="material-icons text-xl">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Descripción / Concepto</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-rose-500 material-icons">description</span>
                                        <input
                                            className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-rose-500 font-display-bold text-sm text-slate-900 dark:text-white transition-all placeholder:text-slate-300"
                                            placeholder="EJ: COMPRA DE MATERIALES DE PINTURA"
                                            value={newExpense.description}
                                            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Categoría</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-rose-500 font-display-bold text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer uppercase"
                                            value={newExpense.category}
                                            onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                                        >
                                            <option value="MATERIALES">MATERIALES</option>
                                            <option value="MANO DE OBRA">MANO DE OBRA</option>
                                            <option value="OTROS">OTROS</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Fecha Compra</label>
                                        <input
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-rose-500 font-display-bold text-sm text-slate-900 dark:text-white transition-all"
                                            type="date"
                                            value={newExpense.date}
                                            onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-rose-500/5 rounded-3xl border border-rose-500/10 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-display-black text-rose-500 uppercase tracking-widest ml-2">Monto Ejecutado (Bs.)</label>
                                    <div className="relative">
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-display-black text-rose-500">Bs.</span>
                                        <input
                                            className="w-full pl-16 pr-6 py-5 bg-white dark:bg-slate-900 border border-rose-500/20 rounded-2xl focus:outline-none focus:border-rose-500 font-display-black text-2xl text-slate-900 dark:text-white shadow-xl shadow-rose-500/5"
                                            type="number"
                                            placeholder="0,00"
                                            value={newExpense.amount_bs}
                                            onChange={(e) => {
                                                const bs = e.target.value;
                                                const usd = newExpense.bcv_rate > 0 ? (parseFloat(bs) / newExpense.bcv_rate).toFixed(2) : '';
                                                setNewExpense({ ...newExpense, amount_bs: bs, amount_usd: usd });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center p-4 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-white/20">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-display-black text-slate-400 uppercase tracking-widest">Equivalencia Final</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-display-black text-emerald-600 dark:text-emerald-400">
                                                {newExpense.amount_usd ? `$${formatNumber(parseFloat(newExpense.amount_usd))}` : '—'}
                                            </span>
                                            {loadingExpenseRate && <span className="material-icons text-xs animate-spin text-emerald-500">sync</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] font-display-black text-slate-400 uppercase tracking-widest">Tasa BCV Aplicada</span>
                                        <p className="font-display-bold text-sm text-slate-700 dark:text-slate-300">
                                            {newExpense.bcv_rate > 0 ? `Bs. ${formatNumber(newExpense.bcv_rate)}` : '...'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-display-black tracking-[0.2em] text-slate-400 uppercase ml-2">Garantía / PDF / Factura</label>
                                <input
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:border-rose-500 font-display-bold text-sm text-slate-900 dark:text-white transition-all uppercase placeholder:text-slate-300"
                                    placeholder="NRO FACTURA O REFERENCIA PAGO"
                                    value={newExpense.reference}
                                    onChange={(e) => setNewExpense({ ...newExpense, reference: e.target.value.toUpperCase() })}
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-200 dark:border-slate-800/50 flex gap-4">
                            <button
                                onClick={() => {
                                    setShowExpenseModal(false);
                                    setEditingExpenseId(null);
                                    setNewExpense({
                                        description: '',
                                        category: 'MATERIALES',
                                        amount_bs: '',
                                        bcv_rate: 0,
                                        amount_usd: '',
                                        date: new Date().toISOString().split('T')[0],
                                        reference: ''
                                    });
                                }}
                                className="flex-1 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-display-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-900/20 transition-all active:scale-95"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleRegisterExpense}
                                className="flex-[2] py-4 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-2xl font-display-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-500/20 hover:shadow-rose-500/40 hover:-translate-y-0.5 transition-all active:scale-95"
                            >
                                {editingExpenseId ? 'GUARDAR CAMBIOS' : 'REGISTRAR EGRESO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== HISTORIAL DE PROYECTOS CERRADOS ===== */}
            {closedProjects.length > 0 && (
                <div className="mt-8">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-icons text-slate-400 text-2xl">history</span>
                        <h2 className="text-xl font-display-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                            Historial de Proyectos Cerrados
                        </h2>
                        <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">{closedProjects.length}</span>
                    </div>
                    <div className="flex flex-col gap-4">
                        {closedProjects.map(cp => {
                            const isExpanded = expandedHistoryId === cp.id;
                            const hd = historyData[cp.id];
                            const closedDate = cp.closed_at ? new Date(cp.closed_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Fecha no registrada';
                            const createdDate = new Date(cp.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
                            const hPays = hd?.payments || [];
                            const hExps = hd?.expenses || [];
                            const hCollected = hPays.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
                            const hExecuted = hExps.reduce((s, e) => s + parseFloat(e.amount_usd || 0), 0);
                            const hProgress = cp.total_budget > 0 ? (hCollected / cp.total_budget) * 100 : 0;
                            return (
                                <div
                                    key={cp.id}
                                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-md transition-all"
                                >
                                    {/* Card header — siempre visible */}
                                    <button
                                        className="w-full flex items-center justify-between p-6 text-left group"
                                        onClick={() => {
                                            const next = isExpanded ? null : cp.id;
                                            setExpandedHistoryId(next);
                                            if (next) fetchHistoryExpanded(next);
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                <span className="material-icons text-slate-400">folder_zip</span>
                                            </div>
                                            <div>
                                                <p className="font-display-black text-slate-800 dark:text-white text-base uppercase tracking-tight">{cp.name}</p>
                                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Torre {cp.tower_id} · Iniciado: {createdDate} · Cerrado: {closedDate}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right hidden md:block">
                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Presupuesto</p>
                                                <p className="font-display-black text-slate-800 dark:text-white text-lg">$ {formatNumber(cp.total_budget)}</p>
                                            </div>
                                            <div className="w-20 hidden md:block">
                                                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, hProgress)}%` }} />
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1 text-right">{hProgress.toFixed(0)}% recaudado</p>
                                            </div>
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-emerald-500/10 rotate-180' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                <span className={`material-icons text-sm ${isExpanded ? 'text-emerald-500' : 'text-slate-400'}`}>expand_more</span>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Detalle expandido — solo lectura */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 p-6">
                                            {!hd ? (
                                                <div className="flex justify-center py-6">
                                                    <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    {/* Resumen Financiero */}
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
                                                        <h4 className="text-xs font-display-black uppercase tracking-widest text-slate-500 mb-4">Resumen Financiero</h4>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">Presupuesto total</span>
                                                                <span className="font-bold text-slate-800 dark:text-white">$ {formatNumber(cp.total_budget)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">Total recaudado</span>
                                                                <span className="font-bold text-emerald-600">$ {formatNumber(hCollected)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">Total ejecutado</span>
                                                                <span className="font-bold text-rose-500">$ {formatNumber(hExecuted)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
                                                                <span className="text-slate-500">Saldo disponible</span>
                                                                <span className={`font-bold ${hCollected - hExecuted >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                    $ {formatNumber(hCollected - hExecuted)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Pagos */}
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
                                                        <h4 className="text-xs font-display-black uppercase tracking-widest text-slate-500 mb-4">Pagos Registrados ({hPays.length})</h4>
                                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                                            {hPays.length === 0 ? (
                                                                <p className="text-slate-400 text-sm text-center py-4">Sin pagos registrados</p>
                                                            ) : hPays.map(p => (
                                                                <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Cuota #{p.installment_number}</p>
                                                                        <p className="text-[10px] text-slate-400">{p.reference} · {p.payment_date}</p>
                                                                    </div>
                                                                    <span className="text-sm font-bold text-emerald-600">$ {formatNumber(p.amount)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {/* Gastos */}
                                                    <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
                                                        <h4 className="text-xs font-display-black uppercase tracking-widest text-slate-500 mb-4">Egresos del Proyecto ({hExps.length})</h4>
                                                        <div className="space-y-2 max-h-56 overflow-y-auto">
                                                            {hExps.length === 0 ? (
                                                                <p className="text-slate-400 text-sm text-center py-4">Sin egresos registrados</p>
                                                            ) : hExps.map(e => (
                                                                <div key={e.id} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{e.description}</p>
                                                                        <p className="text-[10px] text-slate-400">{e.category} · {e.date}</p>
                                                                    </div>
                                                                    <span className="text-sm font-bold text-rose-500">$ {formatNumber(e.amount_usd)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ===== MODAL CONFIRMACIÓN DE CIERRE ===== */}
            {showCloseConfirmModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                <span className="material-icons text-amber-500">archive</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-display-black text-slate-900 dark:text-white">Cerrar Proyecto</h3>
                                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">¿Confirmas el cierre del proyecto:</p>
                        <p className="text-base font-display-black text-slate-900 dark:text-white mb-1 uppercase">{project?.name}</p>
                        <p className="text-xs text-slate-400 mb-6">Torre {selectedTower} · Presupuesto: $ {formatNumber(project?.total_budget || 0)}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl p-3 mb-6">
                            ⚠️ El proyecto quedará archivado en el historial y podrás consultar sus datos en modo lectura. Podrás iniciar un nuevo proyecto cuando lo necesites.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCloseConfirmModal(false)}
                                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-display-black text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCloseProject}
                                disabled={isMutating}
                                className="flex-[2] py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-display-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <span className="material-icons text-sm">archive</span>
                                {isMutating ? 'Archivando...' : 'Confirmar Cierre'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpecialQuotas;

