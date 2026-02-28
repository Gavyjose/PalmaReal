import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatCurrency, formatNumber } from '../utils/formatters';

const PaymentModal = ({ isOpen, onClose, expense, onSubmit }) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [amountUsd, setAmountUsd] = useState(expense?.amount || '');
    const [amountBs, setAmountBs] = useState('');
    const [bcvRate, setBcvRate] = useState(0);
    const [reference, setReference] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchRateForDate(paymentDate);
        }
    }, [isOpen, paymentDate]);

    useEffect(() => {
        if (isOpen && expense) {
            setAmountUsd(expense.amount);
        }
    }, [isOpen, expense]);

    const fetchRateForDate = async (dateStr) => {
        try {
            const { data: rateData, error } = await supabase
                .from('exchange_rates')
                .select('rate_value')
                .lte('rate_date', dateStr)
                .order('rate_date', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (rateData && rateData.length > 0) {
                const newRate = rateData[0].rate_value;
                setBcvRate(newRate);

                // Recalculate USD if Bs is already inputted
                if (amountBs) {
                    const equiv = parseFloat((parseFloat(amountBs) / newRate).toFixed(2));
                    setAmountUsd(equiv);
                }
            }
        } catch (error) {
            console.error('Error fetching rate for date:', error);
        }
    };

    const handleBsChange = (val) => {
        setAmountBs(val);
        if (bcvRate > 0 && val) {
            const equiv = parseFloat((parseFloat(val) / bcvRate).toFixed(2));
            setAmountUsd(equiv);
        }
    };

    const handleUsdChange = (val) => {
        setAmountUsd(val);
        if (bcvRate > 0 && val) {
            const bsApprox = parseFloat((parseFloat(val) * bcvRate).toFixed(2));
            setAmountBs(bsApprox);
        }
    };

    const handleSave = async () => {
        if (!paymentDate || !amountUsd || !reference) {
            alert('Por favor complete todos los campos obligatorios');
            return;
        }

        try {
            setSaving(true);
            const paymentData = {
                payment_date: paymentDate,
                amount_bs: parseFloat(amountBs) || 0,
                bcv_rate_at_payment: bcvRate,
                amount_usd_at_payment: parseFloat(amountUsd),
                bank_reference: reference.toUpperCase(),
                payment_status: 'PAGADO'
            };

            const { error } = await supabase
                .from('period_expenses')
                .update(paymentData)
                .eq('id', expense.id);

            if (error) throw error;

            onSubmit();
            onClose();
        } catch (err) {
            console.error('Error saving payment:', err);
            alert('Error al registrar el pago');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-none border-2 border-slate-900 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b-2 border-slate-900 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Registro de Conformidad</h2>
                        <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest mt-1">{expense?.description}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-none text-slate-500 transition-colors border border-transparent hover:border-slate-300 dark:hover:border-slate-700">
                        <span className="material-icons text-sm block">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-5 flex-1">
                    {/* Fecha de Pago */}
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha Operativa</label>
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-none px-4 py-3 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
                        />
                    </div>

                    {/* Monto en Bolívares */}
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto en Bolívares (Bs)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-mono font-bold">Bs</span>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={amountBs}
                                onChange={(e) => handleBsChange(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-none pl-12 pr-4 py-3 font-mono font-black text-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>

                    {/* Tasa de Cambio */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa de Cambio (BCV)</label>
                            <span className="text-[9px] font-mono font-bold text-slate-400">Bs/$</span>
                        </div>
                        <input
                            type="number"
                            step="0.0001"
                            value={bcvRate}
                            onChange={(e) => setBcvRate(parseFloat(e.target.value))}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-none px-4 py-2 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
                        />
                    </div>

                    {/* Monto en Dólares */}
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Equivalente Liquidado (USD)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-mono font-bold">$</span>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={amountUsd}
                                onChange={(e) => setAmountUsd(e.target.value)}
                                className="w-full bg-emerald-50/30 dark:bg-emerald-900/10 border-2 border-emerald-500/30 rounded-none pl-12 pr-4 py-3 font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-100 dark:border-emerald-800/50">
                        <div className="flex items-center gap-3">
                            <span className="material-icons text-emerald-600 dark:text-emerald-400">info</span>
                            <p className="text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">
                                Se registrará la conformidad del pago por $ {formatCurrency(amountUsd)} en la relación de gastos.
                            </p>
                        </div>
                    </div>

                    {/* Referencia Bancaria */}
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Traza / Referencia</label>
                        <input
                            type="text"
                            placeholder="EJ: 12345678"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none px-4 py-3 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors uppercase placeholder:normal-case"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-none font-bold text-xs font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:border-slate-900 dark:hover:border-white transition-colors"
                    >
                        ABORTAR
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-none font-bold text-xs font-mono uppercase tracking-widest hover:invert transition-all border-2 border-transparent disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="material-icons animate-spin text-[14px]">sync</span>
                                PROCESANDO
                            </>
                        ) : (
                            <>
                                <span className="material-icons text-[14px]">check</span>
                                ASENTAR
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
