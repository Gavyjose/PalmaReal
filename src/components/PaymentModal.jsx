import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatCurrency, formatNumber } from '../utils/formatters';

const PaymentModal = ({ isOpen, onClose, expense, onSubmit }) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [amountBs, setAmountBs] = useState('');
    const [bcvRate, setBcvRate] = useState(0);
    const [reference, setReference] = useState('');
    const [loadingRate, setLoadingRate] = useState(false);
    const [saving, setSaving] = useState(false);

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
                setBcvRate(0);
            }
        } catch (err) {
            console.error('Error fetching rate for payment:', err);
        } finally {
            setLoadingRate(false);
        }
    };

    useEffect(() => {
        if (isOpen && paymentDate) {
            fetchRateForDate(paymentDate);
        }
    }, [isOpen, paymentDate]);

    const amountUsd = bcvRate > 0 && amountBs > 0 ? parseFloat((parseFloat(amountBs) / bcvRate).toFixed(2)) : 0;

    const handleSave = async () => {
        if (!paymentDate || !amountBs || !reference) {
            alert('Por favor complete todos los campos obligatorios');
            return;
        }

        try {
            setSaving(true);
            const paymentData = {
                payment_date: paymentDate,
                amount_bs: parseFloat(amountBs),
                bcv_rate_at_payment: bcvRate,
                amount_usd_at_payment: amountUsd,
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Registrar Pago de Gasto</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">{expense?.description}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                        <span className="material-icons">close</span>
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {/* Fecha de Pago */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fecha del Pago</label>
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                        />
                    </div>

                    {/* Monto en Bolívares */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Monto Pagado (Bs.)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                value={amountBs}
                                onChange={(e) => setAmountBs(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                            />
                        </div>
                    </div>

                    {/* Información de Conversión */}
                    <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-black text-primary/60 uppercase tracking-wider mb-1">Tasa BCV del Día</p>
                                <p className="text-lg font-black text-primary">
                                    {loadingRate ? '...' : `Bs. ${formatNumber(bcvRate)}`}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-primary/60 uppercase tracking-wider mb-1">Equivalente USD</p>
                                <p className="text-lg font-black text-primary">
                                    $ {formatCurrency(amountUsd)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Referencia Bancaria */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Referencia Bancaria / Confirmación</label>
                        <input
                            type="text"
                            placeholder="EJ: 12345678"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none uppercase placeholder:normal-case"
                        />
                    </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-500 font-bold text-sm uppercase hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-2.5 bg-primary text-white font-black text-sm uppercase rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <span className="material-icons animate-spin text-sm">sync</span>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <span className="material-icons text-sm">check_circle</span>
                                Confirmar Pago
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
