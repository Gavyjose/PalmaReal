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
            // Priority: remaining_amount passed directly, else calculated from amount - paid_amount
            const remaining = expense.remaining_amount !== undefined
                ? expense.remaining_amount
                : expense.amount - (expense.paid_amount || 0);

            // Format to 2 decimals to prevent floating point extra long numbers
            setAmountUsd(parseFloat(remaining.toFixed(2)));
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>

            <div className="relative w-full max-w-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-white/20 dark:border-slate-800/50 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Header Section */}
                <div className="px-8 pt-8 pb-4 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">Transacción En Vivo</p>
                        <h2 className="text-2xl font-display-bold text-slate-900 dark:text-white">Registrar Abono</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-emerald-500 hover:scale-110 transition-all duration-300"
                    >
                        <span className="material-icons text-xl">close</span>
                    </button>
                </div>

                <div className="px-8 pb-8">
                    <div className="space-y-6">
                        {/* Summary Info Card */}
                        <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-3xl p-5 border border-emerald-100/50 dark:border-emerald-500/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600">
                                    <span className="material-icons">description</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-wider">Concepto de Gasto</p>
                                    <p className="font-display-bold text-xs text-slate-800 dark:text-emerald-50 truncate max-w-[200px]">{expense?.description || '---'}</p>
                                </div>
                            </div>
                            <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 rounded-full text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tighter">
                                Listo para asentar
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform duration-300">
                                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400 ml-2">
                                    <span className="material-icons text-[14px]">calendar_today</span> Fecha Operativa
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 text-sm font-bold transition-all text-slate-800 dark:text-white"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform duration-300">
                                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400 ml-2">
                                    <span className="material-icons text-[14px]">currency_exchange</span> Tasa BCV (Bs/$)
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 text-sm font-bold transition-all text-slate-800 dark:text-white"
                                    value={bcvRate}
                                    onChange={(e) => setBcvRate(parseFloat(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform duration-300">
                                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400 ml-2">
                                    <span className="material-icons text-[14px]">payments</span> Monto Bs
                                </label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl pl-12 pr-5 py-4 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 text-lg font-display-bold transition-all text-slate-800 dark:text-white"
                                        value={amountBs}
                                        onChange={(e) => handleBsChange(e.target.value)}
                                    />
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within:text-emerald-500">Bs.</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform duration-300">
                                <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400 ml-2">
                                    <span className="material-icons text-[14px]">monetization_on</span> Equiv. USD
                                </label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full bg-emerald-50/30 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/30 rounded-2xl pl-12 pr-5 py-4 outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 text-lg font-display-bold transition-all text-emerald-600 dark:text-emerald-400 shadow-inner"
                                        value={amountUsd}
                                        onChange={(e) => handleUsdChange(e.target.value)}
                                    />
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold group-focus-within:text-emerald-600">$</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform duration-300">
                            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400 ml-2">
                                <span className="material-icons text-[14px]">confirmation_number</span> Traza / Referencia
                            </label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 text-sm font-bold transition-all text-slate-800 dark:text-white"
                                placeholder="EJ: 12345678"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-6 py-4 rounded-[1.5rem] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
                            >
                                ABORTAR
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-[2] px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[1.5rem] font-display-bold text-base shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-tighter"
                            >
                                {saving ? (
                                    <>
                                        <span className="material-icons animate-spin text-lg">sync</span>
                                        PROCESANDO
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons text-xl">check_circle</span>
                                        ASENTAR CONFORMIDAD
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
