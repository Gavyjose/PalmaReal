import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import PrintPreview from '../components/PrintPreview';
import PaymentModal from '../components/PaymentModal';
import { formatCurrency, formatNumber } from '../utils/formatters';

const AliquotsConfig = () => {
    const [selectedTower, setSelectedTower] = useState('');
    const { activeTowers, loading: towersLoading } = useTowers();
    const [period, setPeriod] = useState('FEBRERO 2026');

    // Set initial tower when towers load
    useEffect(() => {
        if (activeTowers.length > 0 && !selectedTower) {
            setSelectedTower(activeTowers[0].name);
        }
    }, [activeTowers]);
    const [expenses, setExpenses] = useState([
        { id: 1, description: 'Mantenimiento y Áreas Comunes', amount: 4500 },
        { id: 2, description: 'Seguridad Privada 24/7', amount: 3200 },
        { id: 3, description: 'Electricidad y Agua Común', amount: 1850 },
        { id: 4, description: 'Administración', amount: 1200 }
    ]);
    const [bcvRate, setBcvRate] = useState(36.50); // Valor por defecto
    const [loadingRate, setLoadingRate] = useState(false);
    const [selectedRateDate, setSelectedRateDate] = useState(new Date().toISOString().split('T')[0]);
    const [actualRateDate, setActualRateDate] = useState(null);
    const [reserveFundAmount, setReserveFundAmount] = useState(0); // Monto fijo solicitado por el usuario
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentPeriodId, setCurrentPeriodId] = useState(null);
    const [periodStatus, setPeriodStatus] = useState('BORRADOR'); // 'BORRADOR' o 'PUBLICADO'
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);

    // Cargar tasa BCV (Soporte para fallback en fines de semana/feriados)
    const fetchBCVRate = async (date = null) => {
        try {
            setLoadingRate(true);
            let query = supabase
                .from('exchange_rates')
                .select('rate_value, rate_date')
                .order('rate_date', { ascending: false });

            if (date) {
                // Buscamos la tasa menor o igual a la fecha seleccionada
                query = query.lte('rate_date', date);
            }

            const { data, error } = await query.limit(1).maybeSingle();

            if (error) {
                console.error('Error fetching BCV rate:', error);
            } else if (data) {
                setBcvRate(parseFloat(parseFloat(data.rate_value).toFixed(2)));
                setActualRateDate(data.rate_date);
                if (date && data.rate_date !== date) {
                    console.log(`Usando tasa de fallback del día ${data.rate_date} para la consulta del ${date}`);
                }
            } else {
                setActualRateDate(null);
                console.warn('No se encontró ninguna tasa disponible en el sistema');
            }
        } catch (err) {
            console.error('Fetch rate error:', err);
        } finally {
            setLoadingRate(false);
        }
    };

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
                setBcvRate(parseFloat(periodData.bcv_rate));
                setReserveFundAmount(parseFloat(periodData.reserve_fund));
                setPeriodStatus(periodData.status || 'BORRADOR');

                const { data: expensesData, error: expError } = await supabase
                    .from('period_expenses')
                    .select('*')
                    .eq('period_id', periodData.id);

                if (expError) throw expError;
                setExpenses(expensesData.map(e => ({
                    id: e.id,
                    description: e.description,
                    amount: e.amount,
                    payment_status: e.payment_status,
                    bank_reference: e.bank_reference,
                    payment_date: e.payment_date,
                    amount_bs: e.amount_bs,
                    bcv_rate_at_payment: e.bcv_rate_at_payment,
                    amount_usd_at_payment: e.amount_usd_at_payment
                })));
            } else {
                setCurrentPeriodId(null);
                setExpenses([]);
                setReserveFundAmount(0);
                setPeriodStatus('BORRADOR');
                fetchBCVRate(selectedRateDate);
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

            const periodToSave = {
                tower_id: selectedTower,
                period_name: period.toUpperCase(),
                reserve_fund: reserveFundAmount,
                bcv_rate: bcvRate,
                status: periodStatus.toUpperCase(),
                updated_at: new Date().toISOString()
            };

            if (periodId) {
                const { error } = await supabase
                    .from('condo_periods')
                    .update(periodToSave)
                    .eq('id', periodId);
                if (error) throw error;
            } else {
                // Usar upsert con onConflict para evitar duplicados si el ID es nulo
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
                const expensesToSave = expenses.map(exp => ({
                    period_id: periodId,
                    description: exp.description,
                    amount: parseFloat(exp.amount),
                    // Preservar datos de pago si existen
                    payment_status: exp.payment_status || 'PENDIENTE',
                    bank_reference: exp.bank_reference || null,
                    payment_date: exp.payment_date || null,
                    amount_bs: exp.amount_bs || null,
                    bcv_rate_at_payment: exp.bcv_rate_at_payment || null,
                    amount_usd_at_payment: exp.amount_usd_at_payment || null
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

    const totalExpenses = useMemo(() => {
        const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        return parseFloat(total.toFixed(2));
    }, [expenses]);

    const reserveFund = parseFloat(parseFloat(reserveFundAmount || 0).toFixed(2));
    const finalTotal = parseFloat((totalExpenses + reserveFund).toFixed(2));
    const aliquotPerUnit = parseFloat((finalTotal / 16).toFixed(2));

    const isPublished = periodStatus === 'PUBLICADO';

    const handleAddExpense = () => {
        if (isPublished) return;
        const newId = crypto.randomUUID();
        setExpenses([...expenses, { id: newId, description: '', amount: 0 }]);
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
                const periodToSave = {
                    tower_id: selectedTower,
                    period_name: period,
                    reserve_fund: reserveFundAmount,
                    bcv_rate: bcvRate,
                    status: newStatus,
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
                    <nav className="flex text-sm text-slate-500 mb-2 gap-2 items-center">
                        <span>Finanzas</span>
                        <span className="material-icons text-[16px]">chevron_right</span>
                        <span className="text-primary font-medium">Configuración de Alícuotas</span>
                    </nav>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">Alícuotas - Torre {selectedTower}</h2>
                    <p className="text-slate-500 text-sm mt-1">{BUILDING_CONFIG.fullName}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isPublished ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                        {periodStatus}
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 flex items-center gap-3">
                        <span className="material-icons text-primary text-sm">apartment</span>
                        <select
                            value={selectedTower}
                            onChange={(e) => setSelectedTower(e.target.value)}
                            disabled={loadingData || saving}
                            className="bg-transparent border-none focus:ring-0 text-sm font-black p-0 pr-8 text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-50"
                        >
                            {activeTowers.map(t => (
                                <option key={t.name} value={t.name}>Torre {t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 flex items-center gap-3">
                        <span className="material-icons text-primary text-sm">calendar_month</span>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            disabled={loadingData || saving}
                            className="bg-transparent border-none focus:ring-0 text-sm font-black p-0 pr-8 text-slate-900 dark:text-white outline-none cursor-pointer disabled:opacity-50"
                        >
                            <option>DICIEMBRE 2025</option>
                            <option>ENERO 2026</option>
                            <option selected>FEBRERO 2026</option>
                            <option>MARZO 2026</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Summary & Expenses */}
                <div className="lg:col-span-12 xl:col-span-4 space-y-6">
                    <div className="bg-primary rounded-xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-white/80 text-sm font-medium mb-1">Total Gastos Torre {selectedTower}</p>
                            <h3 className="text-4xl font-black mb-4">$ {formatCurrency(finalTotal)}</h3>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 bg-white/20 w-fit px-3 py-1 rounded-full text-xs font-bold uppercase">
                                    <span className="material-icons text-[14px]">payments</span>
                                    Alícuota: $ {formatCurrency(aliquotPerUnit)} / APTOS
                                </div>
                            </div>
                        </div>
                        <span className="material-icons absolute -bottom-4 -right-4 text-[120px] text-white/10 rotate-12">account_balance_wallet</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[600px]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                                    <span className="material-icons text-primary">list</span>
                                    Desglose de Gastos
                                </h4>
                                <span className="text-[10px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded uppercase">Tasa: {parseFloat(bcvRate).toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="space-y-4">
                                {expenses.map((exp) => (
                                    <div key={exp.id} className="group p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                className="flex-1 bg-transparent border-none text-sm font-bold text-slate-800 dark:text-white outline-none uppercase disabled:opacity-75"
                                                value={exp.description}
                                                disabled={isPublished}
                                                onChange={(e) => handleUpdateExpense(exp.id, 'description', e.target.value.toUpperCase())}
                                                placeholder="Descripción..."
                                            />
                                            {!isPublished && (
                                                <button onClick={() => handleRemoveExpense(exp.id)} className="text-red-400 hover:text-red-600">
                                                    <span className="material-icons text-sm">delete</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="relative w-32">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        value={exp.amount}
                                                        disabled={isPublished}
                                                        onChange={(e) => handleUpdateExpense(exp.id, 'amount', e.target.value)}
                                                        className="w-full pl-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 rounded-lg text-sm font-bold"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit ${exp.payment_status === 'PAGADO' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {exp.payment_status || 'PENDIENTE'}
                                                        </span>
                                                        {exp.payment_status === 'PAGADO' && (
                                                            <button
                                                                onClick={() => handleResetPayment(exp.id)}
                                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                                                title="Anular pago para corregir"
                                                            >
                                                                <span className="material-icons text-[12px]">undo</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    {exp.bank_reference && (
                                                        <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">REF: {exp.bank_reference}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Bs.</p>
                                                    <p className="text-xs font-black text-slate-600 dark:text-slate-300">
                                                        {exp.payment_status === 'PAGADO' && exp.amount_bs
                                                            ? formatNumber(exp.amount_bs)
                                                            : formatNumber(exp.amount * bcvRate)}
                                                    </p>
                                                </div>
                                                {isPublished && exp.payment_status !== 'PAGADO' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedExpense(exp);
                                                            setShowPaymentModal(true);
                                                        }}
                                                        className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                                                        title="Registrar Pago"
                                                    >
                                                        <span className="material-icons text-sm">payments</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white uppercase text-xs">Fondo de Reserva</h4>
                                            <p className="text-[10px] text-slate-400 underline decoration-primary/30">Monto global de la torre</p>
                                        </div>
                                        <div className="relative w-32">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                            <input
                                                type="number"
                                                value={reserveFundAmount}
                                                disabled={isPublished}
                                                onChange={(e) => setReserveFundAmount(e.target.value)}
                                                className="w-full pl-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-lg text-sm font-black"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {!isPublished && (
                                    <button onClick={handleAddExpense} className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                                        <span className="material-icons text-sm">add</span> AGREGAR GASTO
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Units List */}
                <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6 h-[600px] lg:h-[750px] xl:h-[800px]">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between sticky top-0 z-20">
                            <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Cálculo de Unidades - Torre {selectedTower}</h3>
                            <span className="text-xs font-bold text-slate-500">16 APTOS</span>
                        </div>
                        <div className="overflow-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm">
                                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-6 py-4">Apartamento</th>
                                        <th className="px-6 py-4 text-center">Factor</th>
                                        <th className="px-6 py-4 text-right">Monto USD</th>
                                        <th className="px-6 py-4 text-right">Monto BS.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {[1, 2, 3, 4].map(floor => (
                                        ['A', 'B', 'C', 'D'].map(letter => {
                                            const aptNum = floor === 1 ? `PB-${letter}` : `${floor - 1}-${letter}`;
                                            return (
                                                <tr key={aptNum} className="hover:bg-primary/5 transition-colors group">
                                                    <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-300">{aptNum}</td>
                                                    <td className="px-6 py-3 text-center text-slate-500">1/16</td>
                                                    <td className="px-6 py-3 text-right font-black">$ {formatCurrency(aliquotPerUnit)}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-primary">Bs. {formatNumber(aliquotPerUnit * bcvRate)}</td>
                                                </tr>
                                            );
                                        })
                                    ))}
                                </tbody>
                                <tfoot className="sticky bottom-0 z-10 bg-white dark:bg-slate-900 border-t-2 border-primary/20">
                                    <tr>
                                        <td colSpan="2" className="px-6 py-4 font-black uppercase text-right">Total Facturado</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">$ {formatCurrency(finalTotal)}</td>
                                        <td className="px-6 py-4 text-right font-black text-primary">Bs. {formatNumber(finalTotal * bcvRate)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Footer Controls */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-4">
                                <input
                                    type="date"
                                    value={selectedRateDate}
                                    onChange={(e) => setSelectedRateDate(e.target.value)}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex items-center gap-2 border-l pl-4">
                                    <button onClick={() => fetchBCVRate(selectedRateDate)} className={`p-1.5 text-primary hover:bg-primary/10 rounded-lg ${loadingRate ? 'animate-spin' : ''}`}>
                                        <span className="material-icons text-sm">sync</span>
                                    </button>
                                    <input
                                        type="number"
                                        value={bcvRate}
                                        disabled={isPublished}
                                        onChange={(e) => setBcvRate(parseFloat(e.target.value) || 0)}
                                        className="w-20 bg-white dark:bg-slate-900 border border-slate-200 rounded text-xs font-black text-primary p-1 text-center"
                                    />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Bs/USD</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                {!isPublished && (
                                    <button
                                        onClick={handleSaveData}
                                        disabled={saving || loadingData}
                                        className="px-6 py-3 bg-white dark:bg-slate-900 border-2 border-primary text-primary font-black hover:bg-primary hover:text-white rounded-lg shadow-sm flex items-center gap-2"
                                    >
                                        <span className="material-icons text-sm">{saving ? 'sync' : 'save'}</span>
                                        GUARDAR BORRADOR
                                    </button>
                                )}

                                <button
                                    onClick={handleStatusToggle}
                                    disabled={saving || (!isPublished && !currentPeriodId)}
                                    className={`px-6 py-3 font-bold rounded-lg flex items-center gap-2 shadow-lg disabled:opacity-50 ${isPublished ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
                                        } text-white`}
                                >
                                    <span className="material-icons text-sm">{isPublished ? 'edit' : 'lock'}</span>
                                    {isPublished ? 'RE-ABRIR' : 'CERRAR RECIBO'}
                                </button>

                                <button
                                    onClick={() => setShowPrintPreview(true)}
                                    className="px-10 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-lg flex items-center gap-3 active:scale-95 transition-all cursor-pointer"
                                >
                                    <span className="material-icons text-sm">print</span> IMPRIMIR
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
                        bcvRate,
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
