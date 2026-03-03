import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import PrintPreview from '../components/PrintPreview';
import PaymentModal from '../components/PaymentModal';
import { formatCurrency, formatNumber } from '../utils/formatters';

const AliquotsConfig = () => {
    const [selectedTower, setSelectedTower] = useState('');
    const aliquotsMonthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const currentAliquotsPeriod = `${aliquotsMonthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;
    const [period, setPeriod] = useState(currentAliquotsPeriod);
    const { activeTowers, loading: towersLoading, lastSelectedTower, setLastSelectedTower } = useTowers();

    // Set initial tower when towers load
    useEffect(() => {
        if (activeTowers.length > 0 && !selectedTower) {
            const defaultTower = activeTowers.find(t => t.name === lastSelectedTower)?.name || activeTowers[0].name;
            setSelectedTower(defaultTower);
            if (!lastSelectedTower) setLastSelectedTower(defaultTower);
        }
    }, [activeTowers]);
    const [expenses, setExpenses] = useState([]);
    const [commonExpenses, setCommonExpenses] = useState([]);
    const [newExpenseDesc, setNewExpenseDesc] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [reserveFundAmount, setReserveFundAmount] = useState(0);
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentPeriodId, setCurrentPeriodId] = useState(null);
    const [periodStatus, setPeriodStatus] = useState('BORRADOR');
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);



    // Cargar sugerencias de descripciones únicas de la base de datos
    useEffect(() => {
        const fetchCommonExpenses = async () => {
            try {
                const { data, error } = await supabase
                    .from('period_expenses')
                    .select('description')
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true });
                if (error) throw error;
                if (data) {
                    const uniqueDesc = [...new Set(data.map(e => e.description))].filter(Boolean);
                    setCommonExpenses(uniqueDesc);
                }
            } catch (error) {
                console.error('Error fetching common expenses:', error);
            }
        };
        fetchCommonExpenses();
    }, []);

    // Cargar datos del periodo y sus gastos
    const fetchPeriodData = async () => {
        try {
            setLoadingData(true);
            const { data: periodData, error: periodError } = await supabase
                .from('condo_periods')
                .select('*')
                .eq('tower_id', selectedTower)
                .eq('period_name', period.toUpperCase())
                .maybeSingle();

            if (periodError) throw periodError;

            if (periodData) {
                setCurrentPeriodId(periodData.id);
                setReserveFundAmount(parseFloat(periodData.reserve_fund));
                setPeriodStatus(periodData.status || 'BORRADOR');

                const { data: expensesData, error: expError } = await supabase
                    .from('period_expenses')
                    .select('*')
                    .eq('period_id', periodData.id)
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true });

                if (expError) throw expError;

                let expensesList = expensesData.map(e => ({
                    id: e.id,
                    description: e.description,
                    amount: e.amount,
                    payment_status: e.payment_status,
                    bank_reference: e.bank_reference,
                    payment_date: e.payment_date,
                    amount_bs: e.amount_bs,
                    bcv_rate_at_payment: e.bcv_rate_at_payment,
                    amount_usd_at_payment: e.amount_usd_at_payment,
                    sort_order: e.sort_order,
                    is_bank_commission: e.is_bank_commission || false
                }));

                // Agregar comisión bancaria automática si existe valor guardado
                const bankCommissionsBs = parseFloat(periodData.bank_commissions_total_bs) || 0;

                if (bankCommissionsBs > 0) {
                    // Parsear periodo para obtener mes y año
                    const periodParts = period.toUpperCase().split(' ');
                    const monthName = periodParts[0];
                    const year = periodParts[1] || new Date().getFullYear().toString();
                    const monthIndex = aliquotsMonthNames.indexOf(monthName);
                    const month = (monthIndex + 1).toString().padStart(2, '0');
                    const firstDay = `${year}-${month}-01`;

                    // Obtener tasa BCV del primer día del mes
                    const { data: bcvRate } = await supabase
                        .from('exchange_rates')
                        .select('rate_value')
                        .lte('rate_date', firstDay)
                        .order('rate_date', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    const rate = bcvRate?.rate_value || 1;
                    const commissionUsd = parseFloat((bankCommissionsBs / rate).toFixed(2));

                    // Buscar si ya existe el concepto de COMISION BANCARIA / BANCAREA
                    const existingCommIndex = expensesList.findIndex(e =>
                        e.is_bank_commission ||
                        e.description.includes('COMISION') && e.description.includes('BANC')
                    );

                    const commissionExpense = {
                        id: existingCommIndex >= 0 ? expensesList[existingCommIndex].id : 'bank-commission-auto',
                        description: 'COMISIÓN BANCARIA',
                        amount: existingCommIndex >= 0 ? expensesList[existingCommIndex].amount : commissionUsd,
                        amount_bs: bankCommissionsBs,
                        amount_usd_at_payment: commissionUsd,
                        bcv_rate_at_payment: rate,
                        payment_status: 'PAGADO',
                        payment_date: firstDay,
                        bank_reference: 'SISTEMA BANCARIO',
                        is_bank_commission: true,
                        sort_order: existingCommIndex >= 0 ? expensesList[existingCommIndex].sort_order : expensesList.length
                    };

                    if (existingCommIndex >= 0) {
                        expensesList[existingCommIndex] = commissionExpense;
                    } else {
                        expensesList.push(commissionExpense);
                    }
                }

                setExpenses(expensesList);
                // El cierre del try catch original sigue intacto
            } else {
                setCurrentPeriodId(null);
                setExpenses([]);
                setReserveFundAmount(0);
                setPeriodStatus('BORRADOR');
            }
        } catch (error) {
            console.error('Error loading period data:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSaveData = async (silent = false) => {
        try {
            if (silent) setIsSyncing(true);
            if (!silent) setSaving(true);
            let periodId = currentPeriodId;

            const totalExp = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
            const resFund = parseFloat(parseFloat(reserveFundAmount || 0).toFixed(2));
            const finTotal = parseFloat((totalExp + resFund).toFixed(2));
            const aliPerUnit = parseFloat((finTotal / 16).toFixed(2));

            const periodToSave = {
                tower_id: selectedTower,
                period_name: period.toUpperCase(),
                reserve_fund: reserveFundAmount,
                bcv_rate: 1,
                status: periodStatus.toUpperCase(),
                total_expenses_usd: totalExp,
                reserve_fund_usd: resFund,
                total_to_distribute_usd: finTotal,
                unit_aliquot_usd: aliPerUnit,
                updated_at: new Date().toISOString()
            };

            if (periodId) {
                const { error } = await supabase
                    .from('condo_periods')
                    .update(periodToSave)
                    .eq('id', periodId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('condo_periods')
                    .upsert(periodToSave, { onConflict: ['tower_id', 'period_name'] })
                    .select()
                    .single();
                if (error) throw error;
                periodId = data.id;
                setCurrentPeriodId(periodId);
            }

            // Para auto-guardado solo actualizamos gastos si hay cambios
            if (expenses.length > 0 || periodId) {
                await supabase.from('period_expenses').delete().eq('period_id', periodId);

                if (expenses.length > 0) {
                    const expensesToSave = expenses.map((exp, index) => ({
                        period_id: periodId,
                        description: exp.description,
                        amount: parseFloat(exp.amount),
                        payment_status: exp.payment_status || 'PENDIENTE',
                        bank_reference: exp.bank_reference || null,
                        payment_date: exp.payment_date || null,
                        amount_bs: exp.amount_bs || null,
                        bcv_rate_at_payment: exp.bcv_rate_at_payment || null,
                        amount_usd_at_payment: exp.amount_usd_at_payment || null,
                        sort_order: index,
                        is_bank_commission: exp.is_bank_commission || false
                    }));
                    const { error: insError } = await supabase.from('period_expenses').insert(expensesToSave);
                    if (insError) throw insError;
                }
            }

            if (!silent) {
                fetchPeriodData();
                alert('Datos guardados exitosamente');
            }
            setLastSyncTime(new Date());
        } catch (error) {
            console.error('Error saving data:', error);
            if (!silent) alert(`Error al guardar: ${error.message}`);
        } finally {
            if (silent) setIsSyncing(false);
            if (!silent) setSaving(false);
        }
    };

    useEffect(() => {
        fetchPeriodData();
    }, [selectedTower, period]);

    const expensesTotals = useMemo(() => {
        const base = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        const paidBs = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount_bs) || 0), 0);
        const equivUsd = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount_usd_at_payment) || 0), 0);
        const diffUsd = expenses.reduce((sum, exp) => {
            if (exp.payment_status === 'PAGADO') {
                return sum + (parseFloat(exp.amount || 0) - parseFloat(exp.amount_usd_at_payment || 0));
            }
            return sum;
        }, 0);

        return {
            base: parseFloat(base.toFixed(2)),
            paidBs: parseFloat(paidBs.toFixed(2)),
            equivUsd: parseFloat(equivUsd.toFixed(2)),
            diffUsd: parseFloat(diffUsd.toFixed(2))
        };
    }, [expenses]);

    const totalExpenses = expensesTotals.base;

    const reserveFund = parseFloat(parseFloat(reserveFundAmount || 0).toFixed(2));
    const finalTotal = parseFloat((totalExpenses + reserveFund).toFixed(2));
    const aliquotPerUnit = parseFloat((finalTotal / 16).toFixed(2));

    const isPublished = periodStatus === 'PUBLICADO';

    const handleAddExpense = async () => {
        if (isPublished || !newExpenseDesc || !newExpenseAmount) return;
        const newId = crypto.randomUUID();
        const newExpenses = [
            ...expenses,
            {
                id: newId,
                description: newExpenseDesc.toUpperCase(),
                amount: parseFloat(newExpenseAmount),
                payment_status: 'PENDIENTE',
                sort_order: expenses.length
            }
        ];
        setExpenses(newExpenses);
        setNewExpenseDesc('');
        setNewExpenseAmount('');

        // Auto-guardado inmediato
        await handleSaveData(true);
    };

    const handleUpdateExpense = async (id, field, value) => {
        if (isPublished) return;
        setExpenses(expenses.map(exp => exp.id === id ? { ...exp, [field]: value } : exp));

        // Auto-guardado al salir del campo o tras cambio (se puede mejorar con debounce si es muy frecuente)
        // Por ahora lo ejecutamos para garantizar persistencia inmediata como pidió el usuario
        await handleSaveData(true);
    };

    const handleRemoveExpense = async (id) => {
        if (isPublished) return;
        const filteredExpenses = expenses.filter(exp => exp.id !== id);
        setExpenses(filteredExpenses);

        // Auto-guardado inmediato tras eliminación
        await handleSaveData(true);
    };

    const handleResetPayment = async (expId) => {
        if (!confirm('¿Estás seguro de que deseas anular el registro de pago de este gasto?')) return;

        try {
            setSaving(true);
            const { error } = await supabase
                .from('period_expenses')
                .update({
                    payment_status: 'PENDIENTE',
                    bank_reference: null,
                    payment_date: null,
                    amount_bs: null,
                    bcv_rate_at_payment: null,
                    amount_usd_at_payment: null
                })
                .eq('id', expId);

            if (error) throw error;

            setExpenses(expenses.map(e => e.id === expId ? {
                ...e,
                payment_status: 'PENDIENTE',
                bank_reference: null,
                payment_date: null,
                amount_bs: null,
                bcv_rate_at_payment: null,
                amount_usd_at_payment: null
            } : e));

            alert('Pago anulado exitosamente. Ahora puedes volver a registrarlo si es necesario.');
        } catch (error) {
            console.error('Error resetting payment:', error);
            alert('Error al anular pago: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusToggle = async () => {
        const isClosing = !isPublished;
        const newStatus = isClosing ? 'PUBLICADO' : 'BORRADOR';

        try {
            setSaving(true);
            if (isClosing) {
                let periodId = currentPeriodId;
                const totalExp = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
                const resFund = parseFloat(parseFloat(reserveFundAmount || 0).toFixed(2));
                const finTotal = parseFloat((totalExp + resFund).toFixed(2));
                const aliPerUnit = parseFloat((finTotal / 16).toFixed(2));

                const periodToSave = {
                    tower_id: selectedTower,
                    period_name: period.toUpperCase(),
                    reserve_fund: reserveFundAmount,
                    bcv_rate: 1,
                    status: newStatus,
                    total_expenses_usd: totalExp,
                    reserve_fund_usd: resFund,
                    total_to_distribute_usd: finTotal,
                    unit_aliquot_usd: aliPerUnit,
                    updated_at: new Date().toISOString()
                };

                const { data: pData, error: pError } = await supabase
                    .from('condo_periods')
                    .upsert(periodToSave, {
                        onConflict: ['tower_id', 'period_name']
                    })
                    .select()
                    .single();

                if (pError) throw pError;
                periodId = pData.id;
                setCurrentPeriodId(periodId);

                await supabase.from('period_expenses').delete().eq('period_id', periodId);
                if (expenses.length > 0) {
                    const { error: insError } = await supabase
                        .from('period_expenses')
                        .insert(expenses.map(e => ({
                            period_id: periodId,
                            description: e.description,
                            amount: parseFloat(e.amount),
                            // Preservar datos de pago al cerrar
                            payment_status: e.payment_status || 'PENDIENTE',
                            bank_reference: e.bank_reference || null,
                            payment_date: e.payment_date || null,
                            amount_bs: e.amount_bs || null,
                            bcv_rate_at_payment: e.bcv_rate_at_payment || null,
                            amount_usd_at_payment: e.amount_usd_at_payment || null
                        })));
                    if (insError) throw insError;
                }
            } else {
                const { error } = await supabase
                    .from('condo_periods')
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', currentPeriodId);
                if (error) throw error;
            }

            setPeriodStatus(newStatus);
            alert(isClosing ? 'Recibo Cerrado y Publicado' : 'Recibo Re-abierto para edición');
            fetchPeriodData();
        } catch (error) {
            console.error('Error toggling status:', error);
            alert('No se pudo actualizar el estado: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto p-4 sm:p-8 pb-24 space-y-10">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-2">
                <div className="animate-in fade-in slide-in-from-left-4 duration-700">
                    <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/60 dark:text-emerald-400/60 mb-3">
                        <span className="hover:text-emerald-500 transition-colors cursor-pointer">Finanzas Inteligentes</span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-slate-900 dark:text-white">Alícuotas Mensuales</span>
                    </nav>
                    <h2 className="text-4xl font-display-bold text-slate-900 dark:text-white tracking-tight">
                        Parametrización <span className="text-emerald-500">Torre {selectedTower}</span>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 flex items-center gap-2">
                        <span className="material-icons text-sm text-emerald-500">verified_user</span>
                        {BUILDING_CONFIG.fullName} • Control de Gastos Certificado
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-700">
                    {/* Status Badge */}
                    <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md border shadow-sm flex items-center gap-2 ${isPublished
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        {periodStatus}
                    </div>

                    {/* Sync Status Badge */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/10 dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-white/10 text-[9px] font-bold uppercase tracking-tighter text-slate-400">
                        <span className={`material-icons text-xs ${isSyncing ? 'animate-spin text-emerald-500' : 'text-emerald-500'}`}>
                            {isSyncing ? 'sync' : 'cloud_done'}
                        </span>
                        {isSyncing ? 'Sincronizando...' : lastSyncTime ? `Guardado ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Borrador Local'}
                    </div>

                    {/* Selectors Glass Container */}
                    <div className="flex items-center gap-2 p-1.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/20 dark:border-slate-800/50 shadow-xl shadow-slate-200/20 dark:shadow-none">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                            <span className="material-icons text-emerald-500 text-sm">apartment</span>
                            <select
                                value={selectedTower}
                                onChange={(e) => {
                                    setSelectedTower(e.target.value);
                                    setLastSelectedTower(e.target.value);
                                }}
                                disabled={loadingData || saving}
                                className="bg-transparent border-none focus:ring-0 text-[11px] font-black p-0 pr-8 text-slate-800 dark:text-white outline-none cursor-pointer disabled:opacity-50 uppercase tracking-wider"
                            >
                                {activeTowers.map(t => (
                                    <option key={t.name} value={t.name}>T-{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                            <span className="material-icons text-emerald-500 text-sm">calendar_month</span>
                            <select
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                disabled={loadingData || saving}
                                className="bg-transparent border-none focus:ring-0 text-[11px] font-black p-0 pr-8 text-slate-800 dark:text-white outline-none cursor-pointer disabled:opacity-50 uppercase tracking-wider"
                            >
                                <option>DICIEMBRE 2025</option>
                                <option>ENERO 2026</option>
                                <option>FEBRERO 2026</option>
                                <option>MARZO 2026</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {/* Main Summary Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-emerald-900/20 border border-white/5 animate-in zoom-in-95 duration-700">
                    {/* Abstract Background Design */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] -mr-48 -mt-48 rounded-full"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/5 blur-[80px] -ml-32 -mb-32 rounded-full"></div>

                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
                        <div className="space-y-1">
                            <p className="text-emerald-400 font-black text-[10px] uppercase tracking-[0.25em] mb-2 opacity-80">Presupuesto Ejecutable Mensual</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-display-bold text-emerald-500">$</span>
                                <h3 className="text-6xl font-display-bold tracking-tight">{formatCurrency(finalTotal)}</h3>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mt-4 bg-white/5 w-fit px-3 py-1.5 rounded-full backdrop-blur-md">
                                <span className="material-icons text-emerald-500 text-sm">analytics</span>
                                Distribución Alíquota T-{selectedTower}
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="p-6 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all duration-300">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Costo por Fracción (1/16)</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-lg font-display-bold text-emerald-500">$</span>
                                    <p className="text-3xl font-display-bold">{formatCurrency(aliquotPerUnit)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-6">
                            <div className="text-right">
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Unidades Activas</p>
                                <p className="text-4xl font-display-bold text-white">16</p>
                            </div>
                            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/40 rotate-3 transform hover:rotate-12 hover:scale-110 transition-all duration-500">
                                <span className="material-icons text-3xl">account_balance_wallet</span>
                            </div>
                        </div>
                    </div>
                </div>

                {!isPublished && (
                    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 p-6 rounded-[2rem] shadow-xl shadow-slate-200/20 dark:shadow-none animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                        <h4 className="font-display-bold text-slate-900 dark:text-white uppercase tracking-widest text-[10px] mb-5 flex items-center gap-2 opacity-70">
                            <span className="material-icons text-emerald-500 text-sm">add_circle</span>
                            Registro de Nuevo Desembolso
                        </h4>
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="flex-1 group">
                                <div className="relative">
                                    <input
                                        className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 p-4 rounded-2xl text-[11px] font-black uppercase outline-none focus:border-emerald-500/50 transition-all shadow-sm group-hover:shadow-md"
                                        placeholder="Descripción del concepto u obra..."
                                        value={newExpenseDesc}
                                        spellCheck="true"
                                        list="expense-suggestions"
                                        onChange={(e) => setNewExpenseDesc(e.target.value)}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                                        <span className="material-icons text-sm">edit</span>
                                    </div>
                                </div>
                                <datalist id="expense-suggestions">
                                    {commonExpenses.map((desc, idx) => (
                                        <option key={idx} value={desc} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="w-full lg:w-56 relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-display-bold text-lg">$</span>
                                <input
                                    type="number"
                                    className="w-full pl-10 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-2xl text-sm font-display-bold outline-none focus:border-emerald-500/50 transition-all shadow-sm group-hover:shadow-md"
                                    placeholder="0.00"
                                    value={newExpenseAmount}
                                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleAddExpense}
                                className="px-10 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transform hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-icons text-sm">auto_awesome</span>
                                Inyectar
                            </button>
                        </div>
                    </div>
                )}

                {/* Social Board Table */}
                <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-[2.5rem] shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
                    <div className="p-8 border-b border-white/10 bg-white/30 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div>
                            <h4 className="font-display-bold text-slate-900 dark:text-white uppercase tracking-[0.15em] text-xs">
                                Listado Operativo <span className="text-emerald-500 text-[10px] ml-2 opacity-60">AUDITORÍA EN TIEMPO REAL</span>
                            </h4>
                            <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wider">Desglose detallado de erogaciones del periodo</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end gap-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fondo de Reserva</span>
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-display-bold text-xs">$</span>
                                    <input
                                        type="number"
                                        value={reserveFundAmount}
                                        disabled={isPublished}
                                        onChange={(e) => setReserveFundAmount(e.target.value)}
                                        onBlur={() => handleSaveData(true)}
                                        className="w-32 pl-7 pr-3 py-2 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-display-bold focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table className="w-full border-separate border-spacing-0">
                            <thead className="sticky top-0 z-30">
                                <tr className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10">Concepto de Gasto</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10">
                                        <div className="flex items-center justify-end gap-1">
                                            Monto Base
                                            <span className="text-emerald-500 text-[8px] opacity-40">($)</span>
                                        </div>
                                    </th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10">Conformidad (Bs)</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10">Ejecutado ($)</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10">Delta ($)</th>
                                    <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10">Estatus</th>
                                    <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10">Acción</th>
                                    {!isPublished && <th className="px-4 py-5 border-b border-white/10"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 dark:divide-slate-800/50">
                                {expenses.map((exp) => (
                                    <tr key={exp.id} className="group hover:bg-emerald-500/[0.03] transition-all duration-300">
                                        <td className="px-8 py-5">
                                            <input
                                                className="w-full bg-transparent border-none text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none uppercase tracking-tight focus:text-emerald-500 transition-colors"
                                                value={exp.description}
                                                disabled={isPublished}
                                                spellCheck="true"
                                                onChange={(e) => handleUpdateExpense(exp.id, 'description', e.target.value.toUpperCase())}
                                            />
                                            <div className="h-[1px] w-0 group-hover:w-full bg-emerald-500/30 transition-all duration-500"></div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-1 font-display-bold text-sm text-slate-900 dark:text-white">
                                                {!isPublished ? (
                                                    <div className="relative">
                                                        <span className="absolute -left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-[10px] opacity-60">$</span>
                                                        <input
                                                            type="number"
                                                            value={exp.amount}
                                                            onChange={(e) => handleUpdateExpense(exp.id, 'amount', e.target.value)}
                                                            className="w-24 bg-transparent border-none text-right font-display-bold p-0 focus:ring-0 outline-none hover:text-emerald-500 transition-colors"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span>{formatCurrency(exp.amount)}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="font-mono text-[11px] font-bold text-slate-500">
                                                {exp.amount_bs > 0 ? `${formatNumber(exp.amount_bs)} Bs` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="font-display-bold text-[13px] text-emerald-600 dark:text-emerald-400">
                                                {exp.amount_usd_at_payment > 0 ? `$${formatNumber(exp.amount_usd_at_payment)}` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            {exp.payment_status === 'PAGADO' ? (
                                                <span className={`text-[11px] font-display-bold flex items-center justify-end gap-1 ${exp.amount - exp.amount_usd_at_payment > 0.01 ? "text-emerald-500" : exp.amount - exp.amount_usd_at_payment < -0.01 ? "text-rose-500" : "text-slate-400"
                                                    }`}>
                                                    <span className="material-icons text-[10px]">{exp.amount - exp.amount_usd_at_payment > 0 ? 'trending_up' : 'trending_down'}</span>
                                                    ${formatNumber(Math.abs(exp.amount - exp.amount_usd_at_payment))}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${exp.payment_status === 'PAGADO'
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                    }`}>
                                                    {exp.payment_status || 'PENDIENTE'}
                                                </span>
                                                {exp.bank_reference && (
                                                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">REF: {exp.bank_reference}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {isPublished && exp.payment_status !== 'PAGADO' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedExpense(exp);
                                                            setShowPaymentModal(true);
                                                        }}
                                                        className="flex items-center gap-2 bg-slate-900 dark:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md shadow-emerald-500/10"
                                                    >
                                                        <span className="material-icons text-xs">payments</span>
                                                        Liquidar
                                                    </button>
                                                )}
                                                {exp.payment_status === 'PAGADO' && (
                                                    <button
                                                        onClick={() => handleResetPayment(exp.id)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                                        title="Revertir pago"
                                                    >
                                                        <span className="material-icons text-sm">history_edu</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        {!isPublished && (
                                            <td className="px-4 py-5 text-center">
                                                <button
                                                    onClick={() => handleRemoveExpense(exp.id)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                                >
                                                    <span className="material-icons text-sm">delete_outline</span>
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {expenses.length === 0 && (
                                    <tr>
                                        <td colSpan={isPublished ? 7 : 8} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-30">
                                                <span className="material-icons text-5xl">inventory_2</span>
                                                <p className="font-display-bold text-[10px] uppercase tracking-[0.2em]">Cámara de compensación vacía</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="sticky bottom-0 z-30 bg-emerald-950/90 dark:bg-emerald-500/90 backdrop-blur-xl text-white shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
                                <tr className="font-display-bold border-t border-white/20">
                                    <td className="px-8 py-4 text-right uppercase text-[9px] tracking-widest opacity-70">Operativo Neto</td>
                                    <td className="px-8 py-4 text-right text-sm">
                                        $ {formatNumber(expensesTotals.base)}
                                    </td>
                                    <td className="px-8 py-4 text-right font-mono text-[10px] opacity-70">
                                        {expensesTotals.paidBs > 0 ? `${formatNumber(expensesTotals.paidBs)} Bs` : '—'}
                                    </td>
                                    <td className="px-8 py-4 text-right text-[11px] opacity-70">
                                        {expensesTotals.equivUsd > 0 ? `$${formatNumber(expensesTotals.equivUsd)}` : '—'}
                                    </td>
                                    <td className="px-8 py-4 text-right text-[11px] opacity-70 font-mono">
                                        <span className={expensesTotals.diffUsd > 0.01 ? "text-white" : expensesTotals.diffUsd < -0.01 ? "text-rose-200" : "text-white/50"}>
                                            ${formatNumber(Math.abs(expensesTotals.diffUsd))}
                                        </span>
                                    </td>
                                    <td colSpan={isPublished ? 2 : 3}></td>
                                </tr>
                                <tr className="bg-emerald-500 dark:bg-white text-white dark:text-emerald-900 border-t border-white/20">
                                    <td className="px-8 py-6 text-right font-black uppercase text-[10px] tracking-[0.3em]">Total Ejecutable Distribuible</td>
                                    <td className="px-8 py-6 text-right text-3xl font-display-bold tracking-tighter">
                                        $ {formatCurrency(finalTotal)}
                                    </td>
                                    <td colSpan={isPublished ? 5 : 6} className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-4">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Cuota por Unidad</span>
                                                <span className="text-xl font-display-bold">$ {formatCurrency(aliquotPerUnit)}</span>
                                            </div>
                                            <div className="w-px h-10 bg-white/20 mx-2"></div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Fracciones</span>
                                                <span className="text-xl font-display-bold">16 Units</span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Social Footer Actions */}
                    <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md flex flex-wrap items-center justify-between gap-6 border-t border-white/10">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <span className="material-icons text-emerald-500 text-sm">security</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Compensación Segura Palma Real</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {!isPublished && (
                                <button
                                    onClick={handleSaveData}
                                    disabled={saving || loadingData}
                                    className="px-8 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 text-slate-900 dark:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex items-center gap-3 disabled:opacity-50"
                                >
                                    <span className="material-icons text-emerald-500 text-sm">{saving ? 'sync' : 'cloud_upload'}</span>
                                    Sincronizar Presupuesto
                                </button>
                            )}

                            <button
                                onClick={handleStatusToggle}
                                disabled={saving || (!isPublished && !currentPeriodId)}
                                className={`px-8 py-4 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center gap-3 disabled:opacity-50 ${isPublished
                                    ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                    : 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 hover:scale-105'
                                    }`}
                            >
                                <span className="material-icons text-sm">{isPublished ? 'edit' : 'verified'}</span>
                                {isPublished ? 'Re-abrir Auditoría' : 'Cerrar y Publicar'}
                            </button>

                            <button
                                onClick={() => setShowPrintPreview(true)}
                                className="px-8 py-4 bg-emerald-500/5 hover:bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all flex items-center gap-3"
                            >
                                <span className="material-icons text-sm">print</span>
                                Generar Relación
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modals Container */}
                <div className="fixed inset-0 pointer-events-none z-[100]">
                    {showPrintPreview && (
                        <div className="pointer-events-auto">
                            <PrintPreview
                                isOpen={showPrintPreview}
                                onClose={() => setShowPrintPreview(false)}
                                data={{
                                    selectedTower,
                                    period,
                                    expenses,
                                    finalTotal,
                                    aliquotPerUnit,
                                    reserveFundAmount
                                }}
                            />
                        </div>
                    )}

                    {showPaymentModal && (
                        <div className="pointer-events-auto">
                            <PaymentModal
                                isOpen={showPaymentModal}
                                onClose={() => {
                                    setShowPaymentModal(false);
                                    setSelectedExpense(null);
                                }}
                                expense={selectedExpense}
                                onSubmit={fetchPeriodData}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AliquotsConfig;
