import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatters';

const OwnerAccountStatement = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [financials, setFinancials] = useState({
        totalDebt: 0,
        lastPayment: null
    });

    useEffect(() => {
        fetchAccountStatement();
    }, []);

    const fetchAccountStatement = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get Owner's Unit (Assuming single unit for now, or pick first)
            const { data: ownerUnit, error: unitError } = await supabase
                .from('owners')
                .select('unit_id, units(tower, number)')
                .eq('email', user.email)
                .maybeSingle();

            if (unitError || !ownerUnit) {
                console.error('Unit not found for owner:', unitError);
                setLoading(false);
                return;
            }

            const unitId = ownerUnit.unit_id;

            // 2. Fetch Charges (Condo Periods)
            const { data: charges, error: chargesError } = await supabase
                .from('condo_periods')
                .select(`
                    id,
                    period_name,
                    created_at,
                    reserve_fund,
                    period_expenses (amount)
                `)
                .eq('status', 'PUBLICADO') // Only show published debts
                .order('created_at', { ascending: false });

            if (chargesError) throw chargesError;

            // 3. Fetch Payments
            const { data: payments, error: paymentsError } = await supabase
                .from('unit_payments')
                .select('id, payment_date, amount_usd, reference, status')
                .eq('unit_id', unitId)
                .order('payment_date', { ascending: false });

            if (paymentsError) throw paymentsError;

            // 4. Merge and Process Transactions
            const unifiedTransactions = [];
            let debtAccumulator = 0;

            // Process Charges (Debits)
            charges.forEach(charge => {
                const totalExpenses = charge.period_expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
                const finalTotal = totalExpenses + parseFloat(charge.reserve_fund || 0);
                const aliquot = finalTotal / 16; // Fixed units for now

                unifiedTransactions.push({
                    id: `charge-${charge.id}`,
                    date: charge.created_at, // Or accurate period date
                    description: `Alícuota ${charge.period_name}`,
                    type: 'DEBIT', // Cargo
                    amount: aliquot,
                    status: 'CONFIRMED'
                });
                debtAccumulator += aliquot;
            });

            // Process Payments (Credits)
            payments.forEach(payment => {
                unifiedTransactions.push({
                    id: `payment-${payment.id}`,
                    date: payment.payment_date,
                    description: `Pago Ref: ${payment.reference || 'N/A'}`,
                    type: 'CREDIT', // Abono
                    amount: payment.amount_usd,
                    status: payment.status || 'VERIFIED'
                });
                debtAccumulator -= payment.amount_usd;
            });

            // Sort by date descending
            unifiedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            setTransactions(unifiedTransactions);
            setFinancials({
                totalDebt: Math.max(0, debtAccumulator), // Don't show negative debt
                lastPayment: payments.length > 0 ? payments[0] : null
            });

        } catch (error) {
            console.error('Error fetching account statement:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando estado de cuenta...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header & Stats */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Estado de Cuenta</h2>
                    <p className="text-slate-400 text-sm">Movimientos recientes y balance actual.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl min-w-[180px] shadow-sm">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Saldo Pendiente</p>
                        <p className={`text-2xl font-bold tabular-nums ${financials.totalDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            $ {formatCurrency(financials.totalDebt)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Fecha</th>
                                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Descripción</th>
                                <th className="px-6 py-4 font-semibold text-right text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Monto</th>
                                <th className="px-6 py-4 text-center font-semibold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Tipo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {transactions.length > 0 ? (
                                transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 tabular-nums">
                                            {new Date(tx.date).toLocaleDateString('es-VE')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            {tx.description}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold tabular-nums ${tx.type === 'DEBIT' ? 'text-slate-900 dark:text-white' : 'text-green-600'}`}>
                                            {tx.type === 'DEBIT' ? '-' : '+'}$ {formatCurrency(tx.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${tx.type === 'DEBIT'
                                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30'
                                                }`}>
                                                {tx.type === 'DEBIT' ? 'Cargo' : 'Pago'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">No hay movimientos registrados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OwnerAccountStatement;
