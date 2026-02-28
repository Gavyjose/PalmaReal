import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatCurrency, formatNumber } from '../utils/formatters';

const QuotaPaymentModal = ({ isOpen, onClose, pendingPeriods, unit, onSubmit }) => {
    const [selectedPeriods, setSelectedPeriods] = useState([]);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [amountBs, setAmountBs] = useState('');
    const [bcvRate, setBcvRate] = useState(0);
    const [reference, setReference] = useState('');
    const [loadingRate, setLoadingRate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isEditingRate, setIsEditingRate] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('TRANSFER'); // 'TRANSFER' or 'CASH'
    const [cashAmountUsd, setCashAmountUsd] = useState('');

    // Cargar tasa BCV para la fecha seleccionada usando la función SQL
    const fetchRateForDate = async (date) => {
        try {
            setLoadingRate(true);
            const { data, error } = await supabase.rpc('get_bcv_rate', { p_date: date });

            if (error) throw error;

            if (data !== null && data !== undefined) {
                setBcvRate(parseFloat(data));
            } else {
                setBcvRate(0); // Manejar caso sin tasa (tal vez permitir manual o alertar)
            }
        } catch (err) {
            console.error('Error fetching rate:', err);
        } finally {
            setLoadingRate(false);
        }
    };

    useEffect(() => {
        if (isOpen && paymentDate) {
            fetchRateForDate(paymentDate);
        }
    }, [isOpen, paymentDate]);

    // Calcular totales
    const totalSelectedUsd = selectedPeriods.reduce((sum, p) => sum + p.amount, 0);
    const amountUsd = paymentMethod === 'TRANSFER'
        ? (bcvRate > 0 && amountBs > 0 ? parseFloat((parseFloat(amountBs) / bcvRate).toFixed(2)) : 0)
        : (parseFloat(cashAmountUsd) || 0);

    // Estado de validación del pago (Exceso, Déficit o Exacto)
    const paymentDiff = amountUsd - totalSelectedUsd;
    const isPaymentValid = amountUsd > 0 && selectedPeriods.length > 0;

    const togglePeriod = (period) => {
        if (selectedPeriods.find(p => p.id === period.id)) {
            setSelectedPeriods(selectedPeriods.filter(p => p.id !== period.id));
        } else {
            setSelectedPeriods([...selectedPeriods, period]);
        }
    };

    const handleSave = async () => {
        if (!isPaymentValid || !reference) {
            alert('Por favor complete todos los campos y seleccione al menos una cuota.');
            return;
        }

        try {
            setSaving(true);

            // 1. Insertar Cabezal del Pago
            const paymentData = {
                unit_id: unit.id,
                payment_date: paymentDate,
                amount_bs: paymentMethod === 'TRANSFER' ? parseFloat(amountBs) : null,
                amount_usd: amountUsd,
                bcv_rate: paymentMethod === 'TRANSFER' ? bcvRate : null,
                reference: reference.toUpperCase(),
                payment_method: paymentMethod
            };

            console.log('Intentando guardar pago:', paymentData);
            console.log('unit.id:', unit?.id, 'unit:', unit);

            const { data: payment, error: paymentError } = await supabase
                .from('unit_payments')
                .insert([paymentData])
                .select()
                .single();

            if (paymentError) {
                console.error('ERROR al guardar pago:', paymentError);
                console.error('Código:', paymentError.code);
                console.error('Mensaje:', paymentError.message);
                console.error('Detalles:', paymentError.details);
                alert(`Error al guardar el pago:\n\nCódigo: ${paymentError.code}\nMensaje: ${paymentError.message}\nDetalles: ${paymentError.details || 'N/A'}`);
                return;
            }

            console.log('Pago guardado exitosamente:', payment);

            // 2. Insertar Detalles (Asignación Inteligente)
            if (selectedPeriods.length > 0) {
                const condoAllocations = [];
                const specialAllocations = [];
                let remainingUsd = amountUsd;
                let historyAllocated = 0;

                // Ordenar por prioridad para asegurar que el dinero se distribuya correctamente
                const hasSpecialSelected = selectedPeriods.some(p => p.type === 'SPECIAL');
                const sortedToPay = [...selectedPeriods].sort((a, b) => {
                    // Si el usuario marcó explícitamente una cuota especial, esta toma prioridad 1.
                    // Si no, la prioridad normal es Historia > Alícuotas > Especial.
                    const priority = hasSpecialSelected
                        ? { 'SPECIAL': 1, 'HISTORY': 2, 'CONDO': 3 }
                        : { 'HISTORY': 1, 'CONDO': 2, 'SPECIAL': 3 };

                    const typeDiff = (priority[a.type] || 99) - (priority[b.type] || 99);
                    if (typeDiff !== 0) return typeDiff;
                    // Mismo tipo: Orden cronológico por sortKey (más viejo primero)
                    return (a.sortKey || 0) - (b.sortKey || 0);
                });

                for (const period of sortedToPay) {
                    if (remainingUsd <= 0.001) break; // Casi cero

                    const amountToAllocate = parseFloat(Math.min(remainingUsd, period.amount).toFixed(2));
                    remainingUsd = parseFloat((remainingUsd - amountToAllocate).toFixed(2));

                    if (period.type === 'CONDO') {
                        condoAllocations.push({
                            payment_id: payment.id,
                            period_id: period.id,
                            amount_allocated: amountToAllocate
                        });
                    } else if (period.type === 'SPECIAL') {
                        specialAllocations.push({
                            project_id: period.project_id,
                            unit_id: unit.id,
                            installment_number: period.installment_number,
                            amount: amountToAllocate,
                            amount_bs: paymentMethod === 'TRANSFER' ? parseFloat((parseFloat(amountBs) * (amountToAllocate / amountUsd)).toFixed(2)) : null,
                            bcv_rate: paymentMethod === 'TRANSFER' ? bcvRate : null,
                            payment_method: paymentMethod,
                            reference: reference.toUpperCase(),
                            payment_date: paymentDate,
                            unit_payment_id: payment.id
                        });
                    } else if (period.type === 'HISTORY') {
                        // Descontar de deuda histórica
                        historyAllocated = amountToAllocate;
                    }
                }

                // 3. Manejar excedentes o ajustes de deuda histórica
                // DESACTIVADO: La deuda histórica se mantiene constante para el cálculo dinámico del Libro de Cobranzas
                /*
                if (remainingUsd > 0.001 || historyAllocated > 0) {
                    const finalReduction = historyAllocated + remainingUsd;
                    const newInitialDebt = parseFloat((unit.initial_debt - finalReduction).toFixed(2));

                    const { error: unitUpdateError } = await supabase
                        .from('units')
                        .update({ initial_debt: newInitialDebt })
                        .eq('id', unit.id);

                    if (unitUpdateError) throw unitUpdateError;
                }
                */

                // Guardar alícuotas de condominio
                if (condoAllocations.length > 0) {
                    const { error: allocError } = await supabase
                        .from('unit_payment_allocations')
                        .insert(condoAllocations);
                    if (allocError) throw allocError;
                }

                // Guardar cuotas especiales (Proyectos)
                if (specialAllocations.length > 0) {
                    const { error: specError } = await supabase
                        .from('special_quota_payments')
                        .insert(specialAllocations);
                    if (specError) throw specError;
                }
            }

            alert(`✅ Pago registrado exitosamente.\nReferencia: ${reference.toUpperCase()}\nMonto: $ ${formatCurrency(amountUsd)} ${paymentMethod === 'TRANSFER' ? `(Bs. ${parseFloat(amountBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })})` : '(EFECTIVO)'}`);
            onSubmit();
            onClose();
        } catch (err) {
            console.error('Error inesperado al guardar pago:', err);
            alert('Error inesperado: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-none border-2 border-slate-900 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* Lado Izquierdo: Selección de Deuda */}
                <div className="w-full md:w-1/2 p-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-300 dark:border-slate-800">
                    <div className="p-6 bg-slate-50 dark:bg-slate-950 border-b-2 border-slate-300 dark:border-slate-800">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">Cálculo de Conformidad</h2>
                        <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest">Compromisos de Unidad U-{unit?.number}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 p-6 bg-white dark:bg-slate-900">
                        {pendingPeriods.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 font-mono text-[10px] font-bold uppercase tracking-widest border border-dashed border-slate-300 dark:border-slate-700 p-8">No hay obligaciones detectadas.</div>
                        ) : (
                            [...pendingPeriods]
                                .sort((a, b) => {
                                    // Priority: HISTORY > CONDO > SPECIAL
                                    const priority = { 'HISTORY': 1, 'CONDO': 2, 'SPECIAL': 3 };
                                    if (priority[a.type] !== priority[b.type]) {
                                        return (priority[a.type] || 99) - (priority[b.type] || 99);
                                    }
                                    return (a.sortKey || 0) - (b.sortKey || 0);
                                })
                                .map(period => {
                                    const isSelected = selectedPeriods.find(p => p.id === period.id);
                                    let typeLabel = 'MANTENIMIENTO';
                                    let typeColor = 'text-slate-500';

                                    if (period.type === 'SPECIAL') {
                                        typeLabel = 'PROYECTO ESPECIAL';
                                        typeColor = 'text-amber-600';
                                    } else if (period.type === 'HISTORY') {
                                        typeLabel = 'SALDO HISTÓRICO';
                                        typeColor = 'text-red-600';
                                    }

                                    return (
                                        <div
                                            key={period.id}
                                            onClick={() => togglePeriod(period)}
                                            className={`p-3 rounded-none border-2 cursor-pointer transition-colors flex items-center justify-between group ${isSelected
                                                ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-5 h-5 rounded-none border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600'
                                                    }`}>
                                                    {isSelected && <span className="material-icons text-white dark:text-slate-900 text-xs font-bold block">check</span>}
                                                </div>
                                                <div>
                                                    <p className={`font-mono font-bold text-xs uppercase ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-400'}`}>
                                                        {period.period_name}
                                                    </p>
                                                    <p className={`text-[9px] ${typeColor} font-mono font-bold uppercase tracking-widest`}>
                                                        {typeLabel}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className={`font-mono font-black tabular-nums transition-colors ${isSelected ? 'text-slate-900 dark:text-white text-base' : 'text-slate-500 text-sm'}`}>
                                                $ {formatCurrency(period.amount)}
                                            </p>
                                        </div>
                                    );
                                })
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-800">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Base de Carga USD</span>
                            <span className="text-2xl font-mono font-black text-slate-900 dark:text-white tabular-nums">$ {formatCurrency(totalSelectedUsd)}</span>
                        </div>
                    </div>
                </div>

                {/* Lado Derecho: Detalles del Pago */}
                <div className="w-full md:w-1/2 bg-white dark:bg-slate-900 flex flex-col relative pb-20 md:pb-0">
                    <div className="flex justify-between items-center p-6 bg-slate-50 dark:bg-slate-950 border-b-2 border-slate-300 dark:border-slate-800">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Instrumentación</h2>
                            <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest mt-1">OPERACIÓN CONTABLE</p>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 dark:hover:border-white hover:border-slate-900 transition-colors rounded-none">
                            <span className="material-icons text-sm block">close</span>
                        </button>
                    </div>

                    <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                        {/* Selector de Método de Pago */}
                        <div className="flex gap-2 bg-slate-50 dark:bg-slate-800/50 p-1 border border-slate-300 dark:border-slate-700">
                            <button
                                onClick={() => setPaymentMethod('TRANSFER')}
                                className={`flex-1 py-3 px-2 text-[10px] font-mono font-black tracking-widest uppercase transition-colors flex items-center justify-center gap-2 border-2 ${paymentMethod === 'TRANSFER'
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-none'
                                    : 'border-transparent text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="material-icons text-sm">account_balance</span> BANCO
                            </button>
                            <button
                                onClick={() => setPaymentMethod('CASH')}
                                className={`flex-1 py-3 px-2 text-[10px] font-mono font-black tracking-widest uppercase transition-colors flex items-center justify-center gap-2 border-2 ${paymentMethod === 'CASH'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-none'
                                    : 'border-transparent text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="material-icons text-sm">payments</span> DIVISAS
                            </button>
                        </div>

                        {/* Fecha */}
                        <div>
                            <label className="block text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest mb-1">Fecha Operativa</label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none px-4 py-3 font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
                            />
                        </div>

                        {paymentMethod === 'TRANSFER' ? (
                            <>
                                {/* Monto Bs */}
                                <div>
                                    <label className="block text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest mb-1">Emisión Regulada (Bs.)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">Bs.</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={amountBs}
                                            onChange={(e) => setAmountBs(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none pl-12 pr-4 py-3 font-mono font-black text-xl text-slate-900 dark:text-white outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Tasa y Conversión */}
                                <div className="bg-slate-50 dark:bg-slate-950 px-4 py-4 border border-slate-300 dark:border-slate-800">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">Tasa BCV Referencial</span>
                                        <button
                                            onClick={() => setIsEditingRate(!isEditingRate)}
                                            className="text-[10px] font-mono font-bold text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 px-2 py-0.5 bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors uppercase"
                                        >
                                            {isEditingRate ? 'FIJAR TASA' : 'FORZAR VALOR'}
                                        </button>
                                    </div>

                                    <div className="relative mb-6">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">Bs.</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={bcvRate}
                                            onChange={(e) => setBcvRate(parseFloat(e.target.value) || 0)}
                                            disabled={!isEditingRate}
                                            className={`w-full bg-white dark:bg-slate-900 border ${isEditingRate ? 'border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-700 text-slate-500'} rounded-none pl-10 pr-4 py-2 font-mono font-bold text-slate-900 dark:text-white outline-none transition-colors`}
                                        />
                                        {loadingRate && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="w-3 h-3 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-end pt-4 border-t border-slate-300 dark:border-slate-800">
                                        <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">Equivalente Base Inyectada</span>
                                        <span className={`font-mono font-black text-2xl tracking-tight ${Math.abs(amountUsd - totalSelectedUsd) < 0.1
                                            ? 'text-emerald-600 dark:text-emerald-500'
                                            : (amountUsd < totalSelectedUsd ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-500')
                                            }`}>
                                            $ {formatCurrency(amountUsd)}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 border-2 border-emerald-500 dark:border-emerald-600/50">
                                <label className="block text-[10px] font-mono font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest mb-3 text-center">Inyección de Divisas</label>
                                <div className="relative max-w-sm mx-auto">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-mono font-black text-2xl">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={cashAmountUsd}
                                        onChange={(e) => setCashAmountUsd(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-none pl-12 pr-4 py-4 font-mono font-black text-emerald-800 dark:text-emerald-400 outline-none text-3xl text-center placeholder:text-emerald-200 dark:placeholder:text-emerald-900/50 tabular-nums"
                                    />
                                </div>
                                <p className="text-[9px] text-emerald-700 dark:text-emerald-500 font-mono font-bold uppercase text-center mt-4">Liquidez directa a pasivo seleccionado</p>
                            </div>
                        )}

                        {/* Referencia */}
                        <div>
                            <label className="block text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest mb-1">Traza de Auditoría (Referencia)</label>
                            <input
                                type="text"
                                placeholder={paymentMethod === 'CASH' ? "EFECTIVO ENTREGADO" : "EJ: 12345678"}
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none px-4 py-3 font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-slate-900 dark:focus:border-white transition-colors uppercase placeholder:normal-case tracking-widest"
                            />
                        </div>

                        {/* Validación */}
                        {selectedPeriods.length > 0 && Math.abs(amountUsd - totalSelectedUsd) > 0.1 && (
                            <div className={`p-4 rounded-none text-[10px] font-mono font-bold border-l-4 flex items-center gap-3 uppercase tracking-widest ${amountUsd < totalSelectedUsd
                                ? 'bg-red-50 text-red-700 border-red-600 dark:bg-red-950/30 dark:text-red-400 dark:border-red-500/50'
                                : 'bg-blue-50 text-blue-700 border-blue-600 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-500/50'
                                }`}>
                                <span className="material-icons text-lg">{amountUsd < totalSelectedUsd ? 'warning' : 'info'}</span>
                                {amountUsd < totalSelectedUsd
                                    ? `Déficit: Faltan $ ${formatCurrency(totalSelectedUsd - amountUsd)} de carga seleccionada.`
                                    : `Exceso: $ ${formatCurrency(amountUsd - totalSelectedUsd)} se registrará como abono.`
                                }
                            </div>
                        )}
                    </div>

                    {/* Botones */}
                    <div className="absolute bottom-0 left-0 w-full md:relative p-4 md:p-6 bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-800 flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-none font-mono font-bold text-[10px] uppercase tracking-widest border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:border-slate-900 hover:text-slate-900 dark:hover:border-white dark:hover:text-white transition-colors h-14"
                        >
                            CANCELAR
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !isPaymentValid}
                            className={`flex-[2] px-4 py-3 rounded-none font-mono font-black text-xs uppercase tracking-widest transition-all h-14 border-2 border-transparent disabled:opacity-50 flex items-center justify-center gap-2 ${saving || !isPaymentValid
                                ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:invert'
                                }`}
                        >
                            {saving ? (
                                <>
                                    <span className="material-icons animate-spin text-sm">sync</span> PROCESANDO
                                </>
                            ) : (
                                <>
                                    <span className="material-icons text-sm">check</span> LIQUIDAR
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuotaPaymentModal;
