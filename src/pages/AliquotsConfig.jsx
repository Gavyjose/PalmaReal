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

    const handleSaveData = async () => {
        try {
            setSaving(true);
            let periodId = currentPeriodId;

            const totalExp = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
            const resFund = parseFloat(parseFloat(reserveFundAmount || 0).toFixed(2));
            const finTotal = parseFloat((totalExp + resFund).toFixed(2));
            const aliPerUnit = parseFloat((finTotal / 16).toFixed(2));

            const periodToSave = {
                tower_id: selectedTower,
                period_name: period.toUpperCase(),
                reserve_fund: reserveFundAmount,
                bcv_rate: 1, // Defaulting to 1 as we only use USD here
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

            await supabase.from('period_expenses').delete().eq('period_id', periodId);

            if (expenses.length > 0) {
                const expensesToSave = expenses.map((exp, index) => ({
                    period_id: periodId,
                    description: exp.description,
                    amount: parseFloat(exp.amount),
                    // Preservar datos de pago si existen
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

            fetchPeriodData();
            alert('Datos guardados exitosamente');
        } catch (error) {
            console.error('Error saving data:', error);
            alert(`Error al guardar: ${error.message}`);
        } finally {
            setSaving(false);
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

    const handleAddExpense = () => {
        if (isPublished || !newExpenseDesc || !newExpenseAmount) return;
        const newId = crypto.randomUUID();
        setExpenses([
            ...expenses,
            {
                id: newId,
                description: newExpenseDesc.toUpperCase(),
                amount: parseFloat(newExpenseAmount),
                payment_status: 'PENDIENTE',
                sort_order: expenses.length
            }
        ]);
        setNewExpenseDesc('');
        setNewExpenseAmount('');
    };

    const handleUpdateExpense = (id, field, value) => {
        if (isPublished) return;
        setExpenses(expenses.map(exp => exp.id === id ? { ...exp, [field]: value } : exp));
    };

    const handleRemoveExpense = (id) => {
        if (isPublished) return;
        setExpenses(expenses.filter(exp => exp.id !== id));
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
        <div className="max-w-[1400px] mx-auto p-8 pb-20 space-y-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <nav className="flex text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-2 gap-2 items-center">
                        <span className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">Finanzas</span>
                        <span>/</span>
                        <span className="text-slate-900 dark:text-white">Alícuotas</span>
                    </nav>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Parametrización - Torre {selectedTower}</h2>
                    <p className="text-slate-500 text-sm mt-1 font-mono">{BUILDING_CONFIG.fullName}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest border ${isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-700' : 'bg-amber-50 text-amber-700 border-amber-700'
                        }`}>
                        {periodStatus}
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none px-4 py-2 flex items-center gap-3">
                        <span className="material-icons text-slate-500 text-sm">apartment</span>
                        <select
                            value={selectedTower}
                            onChange={(e) => {
                                setSelectedTower(e.target.value);
                                setLastSelectedTower(e.target.value);
                            }}
                            disabled={loadingData || saving}
                            className="bg-transparent border-none focus:ring-0 text-xs font-mono font-bold p-0 pr-8 text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-50 uppercase tracking-widest"
                        >
                            {activeTowers.map(t => (
                                <option key={t.name} value={t.name}>TORRE {t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none px-4 py-2 flex items-center gap-3">
                        <span className="material-icons text-slate-500 text-sm">calendar_month</span>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            disabled={loadingData || saving}
                            className="bg-transparent border-none focus:ring-0 text-xs font-mono font-bold p-0 pr-8 text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-50 uppercase tracking-widest"
                        >
                            <option>DICIEMBRE 2025</option>
                            <option>ENERO 2026</option>
                            <option>FEBRERO 2026</option>
                            <option>MARZO 2026</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Main Content Area */}
                <div className="space-y-6">
                    <div className="bg-slate-900 dark:bg-slate-800 rounded-none p-6 text-white border-b-4 border-slate-500 relative overflow-hidden">
                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div>
                                <p className="text-slate-400 font-mono text-[10px] font-bold uppercase tracking-widest mb-1">Presupuesto Ejecutable T-{selectedTower}</p>
                                <h3 className="text-4xl font-mono font-black">$ {formatCurrency(finalTotal)}</h3>
                            </div>
                            <div className="flex items-center">
                                <div className="flex items-center gap-2 border border-slate-700 bg-slate-800/50 w-fit px-3 py-1 rounded-none text-xs font-mono font-bold uppercase tracking-widest text-slate-300">
                                    <span className="material-icons text-[14px]">payments</span>
                                    Cuota: $ {formatCurrency(aliquotPerUnit)} / Fracción
                                </div>
                            </div>
                            <div className="flex items-center justify-end">
                                <div className="text-right">
                                    <p className="text-slate-400 font-mono text-[10px] font-bold uppercase tracking-widest mb-1">Unidades</p>
                                    <p className="text-2xl font-mono font-black">16</p>
                                </div>
                            </div>
                        </div>
                        <span className="material-icons absolute -bottom-4 -right-4 text-[120px] text-slate-800 dark:text-slate-700 rotate-12">account_balance_wallet</span>
                    </div>

                    {!isPublished && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4">
                            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="material-icons text-sm">add_circle</span>
                                Cargar Nuevo Gasto
                            </h4>
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <input
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-3 rounded-none text-xs font-mono font-bold uppercase outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
                                        placeholder="Descripción del concepto..."
                                        value={newExpenseDesc}
                                        spellCheck="true"
                                        list="expense-suggestions"
                                        onChange={(e) => setNewExpenseDesc(e.target.value)}
                                    />
                                    <datalist id="expense-suggestions">
                                        {commonExpenses.map((desc, idx) => (
                                            <option key={idx} value={desc} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="w-full md:w-48 relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">$</span>
                                    <input
                                        type="number"
                                        className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-none text-xs font-mono font-bold outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
                                        placeholder="0.00"
                                        value={newExpenseAmount}
                                        onChange={(e) => setNewExpenseAmount(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleAddExpense}
                                    className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono text-[10px] font-black uppercase tracking-widest hover:invert transition-all"
                                >
                                    Añadir
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800">
                        <div className="p-4 border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-xs">
                                Listado Operativo de Gastos
                            </h4>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Reserva:</span>
                                    <div className="relative w-32">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-[10px]">$</span>
                                        <input
                                            type="number"
                                            value={reserveFundAmount}
                                            disabled={isPublished}
                                            onChange={(e) => setReserveFundAmount(e.target.value)}
                                            className="w-full pl-6 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none text-xs font-mono font-black focus:border-slate-900 dark:focus:border-white outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[440px] overflow-y-auto custom-scrollbar-thin">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 shadow-sm">
                                    <tr className="bg-slate-100 dark:bg-slate-800/50 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-left">Concepto</th>
                                        <th className="px-6 py-4 text-right">Monto ($)</th>
                                        <th className="px-6 py-4 text-right">Pagado (Bs)</th>
                                        <th className="px-6 py-4 text-right">Equivalente ($)</th>
                                        <th className="px-6 py-4 text-right">Diferencia ($)</th>
                                        <th className="px-6 py-4 text-center">Estado</th>
                                        <th className="px-6 py-4 text-center w-40">Asentar Pago</th>
                                        {!isPublished && <th className="px-6 py-4 text-center w-16"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {expenses.map((exp) => (
                                        <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <input
                                                    className="w-full bg-transparent border-none text-xs font-mono font-bold text-slate-800 dark:text-white outline-none uppercase disabled:opacity-75"
                                                    value={exp.description}
                                                    disabled={isPublished}
                                                    spellCheck="true"
                                                    list="expense-suggestions"
                                                    onChange={(e) => handleUpdateExpense(exp.id, 'description', e.target.value.toUpperCase())}
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-slate-400 font-mono text-xs">$</span>
                                                    <input
                                                        type="number"
                                                        value={exp.amount}
                                                        disabled={isPublished}
                                                        onChange={(e) => handleUpdateExpense(exp.id, 'amount', e.target.value)}
                                                        className="w-24 bg-transparent border-none text-right text-sm font-mono font-black text-slate-900 dark:text-white focus:ring-0 outline-none"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-[11px] font-bold text-slate-500 bg-slate-50/20">
                                                {exp.amount_bs > 0 ? `${formatNumber(exp.amount_bs)} Bs` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-[11px] font-bold text-emerald-600">
                                                {exp.amount_usd_at_payment > 0 ? `$ ${formatNumber(exp.amount_usd_at_payment)}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-[11px] font-bold">
                                                {exp.payment_status === 'PAGADO' ? (
                                                    <span className={exp.amount - exp.amount_usd_at_payment > 0.01 ? "text-emerald-500" : exp.amount - exp.amount_usd_at_payment < -0.01 ? "text-red-500" : "text-slate-400"}>
                                                        $ {formatNumber(Math.abs(exp.amount - exp.amount_usd_at_payment))}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`px-2 py-0.5 border text-[9px] font-mono font-black uppercase tracking-widest ${exp.payment_status === 'PAGADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
                                                        }`}>
                                                        {exp.payment_status || 'PENDIENTE'}
                                                    </span>
                                                    {exp.bank_reference && (
                                                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-tight">R: {exp.bank_reference}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {isPublished && exp.payment_status !== 'PAGADO' && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedExpense(exp);
                                                                setShowPaymentModal(true);
                                                            }}
                                                            className="px-3 py-1.5 rounded-none border border-slate-900 dark:border-white text-slate-900 dark:text-white text-[10px] font-mono font-black uppercase hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all flex items-center gap-2"
                                                        >
                                                            <span className="material-icons text-xs">payments</span>
                                                            Liquidar
                                                        </button>
                                                    )}
                                                    {exp.payment_status === 'PAGADO' && (
                                                        <button
                                                            onClick={() => handleResetPayment(exp.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Anular conformidad"
                                                        >
                                                            <span className="material-icons text-xs">undo</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            {!isPublished && (
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => handleRemoveExpense(exp.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                                        <span className="material-icons text-sm">delete</span>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {expenses.length === 0 && (
                                        <tr>
                                            <td colSpan={isPublished ? 4 : 5} className="px-6 py-12 text-center text-slate-400 font-mono text-xs uppercase tracking-widest italic">
                                                No hay gastos registrados en este periodo
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="sticky bottom-0 z-20 bg-slate-50 dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                                    <tr className="font-mono font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50">
                                        <td className="px-6 py-4 text-right uppercase text-[10px] tracking-widest text-slate-500">Subtotal Operativo</td>
                                        <td className="px-6 py-4 text-right text-xs">
                                            $ {formatNumber(expensesTotals.base)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-[11px] text-slate-500">
                                            {expensesTotals.paidBs > 0 ? `${formatNumber(expensesTotals.paidBs)} Bs` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-[11px] text-emerald-600">
                                            {expensesTotals.equivUsd > 0 ? `$ ${formatNumber(expensesTotals.equivUsd)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-[11px]">
                                            <span className={expensesTotals.diffUsd > 0.01 ? "text-emerald-500" : expensesTotals.diffUsd < -0.01 ? "text-red-500" : "text-slate-400"}>
                                                $ {formatNumber(Math.abs(expensesTotals.diffUsd))}
                                            </span>
                                        </td>
                                        <td colSpan={isPublished ? 2 : 3}></td>
                                    </tr>
                                    <tr className="font-mono font-black text-slate-900 dark:text-white bg-slate-900 dark:bg-white text-white dark:text-slate-900">
                                        <td className="px-6 py-4 text-right uppercase text-[10px] tracking-widest text-slate-400 dark:text-slate-500">Total a Distribuir</td>
                                        <td className="px-6 py-4 text-right text-lg">
                                            $ {formatCurrency(finalTotal)}
                                        </td>
                                        <td colSpan={isPublished ? 2 : 3} className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 text-[10px] uppercase tracking-widest opacity-70">
                                                <span className="material-icons text-xs">info</span>
                                                16 Fracciones de $ {formatCurrency(aliquotPerUnit)}
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Footer Controls */}
                        <div className="p-4 bg-slate-100 dark:bg-slate-950 flex flex-col md:flex-row items-center justify-end gap-4 border-t-2 border-slate-300 dark:border-slate-800">
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                                {!isPublished && (
                                    <button
                                        onClick={handleSaveData}
                                        disabled={saving || loadingData}
                                        className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] uppercase font-black hover:border-slate-900 dark:hover:border-white rounded-none flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        <span className="material-icons text-[14px]">{saving ? 'sync' : 'save_as'}</span>
                                        RETENER PRESUPUESTO
                                    </button>
                                )}

                                <button
                                    onClick={handleStatusToggle}
                                    disabled={saving || (!isPublished && !currentPeriodId)}
                                    className={`px-6 py-3 font-mono text-[10px] uppercase font-black rounded-none flex items-center gap-2 transition-all disabled:opacity-50 border-2 border-transparent ${isPublished ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:invert'
                                        }`}
                                >
                                    <span className="material-icons text-[14px]">{isPublished ? 'edit_note' : 'lock_open'}</span>
                                    {isPublished ? 'RE-ABRIR EDICIÓN' : 'ASENTAR Y PUBLICAR'}
                                </button>

                                <button
                                    onClick={() => setShowPrintPreview(true)}
                                    className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] uppercase font-black hover:border-slate-900 dark:hover:border-white rounded-none flex items-center gap-2 transition-colors"
                                >
                                    <span className="material-icons text-[14px]">print</span>
                                    IMPRIMIR RELACIÓN
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Preview Modal */}
            {showPrintPreview && (
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
            )}

            {showPaymentModal && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => {
                        setShowPaymentModal(false);
                        setSelectedExpense(null);
                    }}
                    expense={selectedExpense}
                    onSubmit={fetchPeriodData}
                />
            )}
        </div>
    );
};

export default AliquotsConfig;
