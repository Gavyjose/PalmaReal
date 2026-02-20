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

    // Cargar tasa BCV para la fecha seleccionada
    const fetchRateForDate = async (date) => {
        try {
            setLoadingRate(true);
            const { data, error } = await supabase
                .from('exchange_rates')
                .select('rate_value')
                .lte('rate_date', date)
                .order('rate_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                setBcvRate(parseFloat(data.rate_value));
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

                // Ordenar por prioridad para asegurar que el dinero se distribuya correctamente
                // Prioridad: Especiales -> Histórica -> Mensualidades (Cronológico)
                const sortedToPay = [...selectedPeriods].sort((a, b) => {
                    const priority = { 'SPECIAL': 1, 'HISTORY': 2, 'CONDO': 3 };
                    const typeDiff = (priority[a.type] || 99) - (priority[b.type] || 99);
                    if (typeDiff !== 0) return typeDiff;
                    // Si son del mismo tipo (especialmente CONDO), ordenar cronológicamente por sortKey
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
                            reference: reference.toUpperCase(),
                            payment_date: paymentDate,
                            unit_payment_id: payment.id
                        });
                    } else if (period.type === 'HISTORY') {
                        // Descontar de deuda histórica
                        const newInitialDebt = Math.max(0, parseFloat((unit.initial_debt - amountToAllocate).toFixed(2)));
                        const { error: unitUpdateError } = await supabase
                            .from('units')
                            .update({ initial_debt: newInitialDebt })
                            .eq('id', unit.id);

                        if (unitUpdateError) throw unitUpdateError;
                    }
                }

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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* Lado Izquierdo: Selección de Deuda */}
                <div className="w-full md:w-1/2 p-6 border-r border-slate-100 dark:border-slate-800 flex flex-col">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">Seleccionar Cuotas</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase mb-6">Marque las cuotas que desea pagar</p>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {pendingPeriods.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 italic">No hay cuotas pendientes.</div>
                        ) : (
                            [...pendingPeriods]
                                .sort((a, b) => {
                                    // Priority: SPECIAL > HISTORY > CONDO
                                    const priority = { 'SPECIAL': 1, 'HISTORY': 2, 'CONDO': 3 };
                                    return (priority[a.type] || 99) - (priority[b.type] || 99);
                                })
                                .map(period => {
                                    const isSelected = selectedPeriods.find(p => p.id === period.id);
                                    let typeLabel = 'Mensualidad';
                                    let typeColor = 'text-slate-400';

                                    if (period.type === 'SPECIAL') {
                                        typeLabel = 'Cuota Especial';
                                        typeColor = 'text-amber-500';
                                    } else if (period.type === 'HISTORY') {
                                        typeLabel = 'Saldo Anterior / Histórico';
                                        typeColor = 'text-red-400';
                                    }

                                    return (
                                        <div
                                            key={period.id}
                                            onClick={() => togglePeriod(period)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between group ${isSelected
                                                ? 'border-primary bg-primary/5'
                                                : 'border-slate-100 dark:border-slate-800 hover:border-primary/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                                                    }`}>
                                                    {isSelected && <span className="material-icons text-white text-xs">check</span>}
                                                </div>
                                                <div>
                                                    <p className={`font-bold text-sm uppercase ${isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        {period.period_name}
                                                    </p>
                                                    <p className={`text-[10px] ${typeColor} font-bold uppercase tracking-tighter`}>
                                                        {typeLabel}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="font-extrabold text-slate-900 dark:text-white">
                                                $ {formatCurrency(period.amount)}
                                            </p>
                                        </div>
                                    );
                                })
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-500 uppercase">Total Seleccionado</span>
                            <span className="text-2xl font-black text-slate-900 dark:text-white">$ {formatCurrency(totalSelectedUsd)}</span>
                        </div>
                    </div>
                </div>

                {/* Lado Derecho: Detalles del Pago */}
                <div className="w-full md:w-1/2 p-6 bg-slate-50 dark:bg-slate-800/30 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Registrar Pago</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase mt-1">Torre {unit?.tower} - Apto {unit?.number}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
                            <span className="material-icons">close</span>
                        </button>
                    </div>

                    <div className="space-y-5 flex-1 overflow-y-auto">
                        {/* Selector de Método de Pago */}
                        <div className="flex gap-2 mb-2 bg-white dark:bg-slate-900 overflow-hidden border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
                            <button
                                onClick={() => setPaymentMethod('TRANSFER')}
                                className={`flex-1 py-2 px-4 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${paymentMethod === 'TRANSFER'
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="material-icons text-xs">account_balance</span> TRANSFERENCIA
                            </button>
                            <button
                                onClick={() => setPaymentMethod('CASH')}
                                className={`flex-1 py-2 px-4 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${paymentMethod === 'CASH'
                                    ? 'bg-green-600 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="material-icons text-xs">payments</span> EFECTIVO (USD)
                            </button>
                        </div>

                        {/* Fecha */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fecha del Pago</label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:border-primary"
                            />
                        </div>

                        {paymentMethod === 'TRANSFER' ? (
                            <>
                                {/* Monto Bs */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Monto Transferido (Bs.)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0,00"
                                            value={amountBs}
                                            onChange={(e) => setAmountBs(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 font-black text-slate-900 dark:text-white outline-none focus:border-primary text-lg"
                                        />
                                    </div>
                                </div>

                                {/* Tasa y Conversión */}
                                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa BCV ({paymentDate})</span>
                                        <button
                                            onClick={() => setIsEditingRate(!isEditingRate)}
                                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            <span className="material-icons text-xs">{isEditingRate ? 'check' : 'edit'}</span>
                                            {isEditingRate ? 'LISTO' : 'EDITAR'}
                                        </button>
                                    </div>

                                    <div className="relative mb-4">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Bs.</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={bcvRate}
                                            onChange={(e) => setBcvRate(parseFloat(e.target.value) || 0)}
                                            disabled={!isEditingRate}
                                            className={`w-full bg-slate-50 dark:bg-slate-800/50 border ${isEditingRate ? 'border-primary ring-1 ring-primary/20' : 'border-slate-100 dark:border-slate-700'} rounded-lg pl-10 pr-4 py-2 font-bold text-slate-900 dark:text-white outline-none transition-all`}
                                        />
                                        {loadingRate && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Equivalente USD</span>
                                        <span className={`font-black text-lg ${Math.abs(amountUsd - totalSelectedUsd) < 0.1
                                            ? 'text-green-600'
                                            : (amountUsd < totalSelectedUsd ? 'text-red-500' : 'text-blue-500')
                                            }`}>
                                            $ {formatCurrency(amountUsd)}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="bg-green-50/50 dark:bg-green-900/10 rounded-2xl p-6 border border-green-200 dark:border-green-900/30">
                                <label className="block text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest mb-3 text-center">Monto en Dólares Efectivo</label>
                                <div className="relative max-w-[200px] mx-auto">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 font-black text-2xl">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0,00"
                                        value={cashAmountUsd}
                                        onChange={(e) => setCashAmountUsd(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-green-500 rounded-2xl pl-12 pr-4 py-4 font-black text-green-600 dark:text-green-400 outline-none shadow-lg shadow-green-500/10 text-3xl text-center"
                                    />
                                </div>
                                <p className="text-[10px] text-green-600 dark:text-green-500 font-bold uppercase text-center mt-4">Este monto se aplicará directo a la deuda</p>
                            </div>
                        )}

                        {/* Referencia */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Referencia / Observación</label>
                            <input
                                type="text"
                                placeholder={paymentMethod === 'CASH' ? "ej: pago en conserjeria" : "ej: 12345678"}
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:border-primary uppercase"
                            />
                        </div>

                        {/* Validación */}
                        {selectedPeriods.length > 0 && Math.abs(amountUsd - totalSelectedUsd) > 0.1 && (
                            <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${amountUsd < totalSelectedUsd
                                ? 'bg-red-50 text-red-600 border border-red-100'
                                : 'bg-blue-50 text-blue-600 border border-blue-100'
                                }`}>
                                <span className="material-icons text-sm">{amountUsd < totalSelectedUsd ? 'warning' : 'info'}</span>
                                {amountUsd < totalSelectedUsd
                                    ? `Faltan $ ${formatCurrency(totalSelectedUsd - amountUsd)} para cubrir lo seleccionado.`
                                    : `Hay un excedente de $ ${formatCurrency(amountUsd - totalSelectedUsd)} (Abono futuro).`
                                }
                            </div>
                        )}
                    </div>

                    {/* Botones */}
                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !isPaymentValid}
                            className={`flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${saving || !isPaymentValid
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-primary hover:bg-blue-600 shadow-primary/25'
                                }`}
                        >
                            {saving ? 'Guardando...' : 'Registrar Pago'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuotaPaymentModal;
