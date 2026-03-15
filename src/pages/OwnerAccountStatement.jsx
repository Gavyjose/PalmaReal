import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useOwnerData } from '../hooks/useOwnerData';

const fmt = (val) => parseFloat(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthMap = { ENERO:1,FEBRERO:2,MARZO:3,ABRIL:4,MAYO:5,JUNIO:6,JULIO:7,AGOSTO:8,SEPTIEMBRE:9,OCTUBRE:10,NOVIEMBRE:11,DICIEMBRE:12 };

const OwnerAccountStatement = () => {
    const { unit, loading: dataLoading } = useOwnerData();
    const [rows, setRows] = useState([]);
    const [finalBalance, setFinalBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (unit) fetchData();
        else if (!dataLoading) setLoading(false);
    }, [unit, dataLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchData = async () => {
        try {
            setLoading(true);
            const normalizedTower = unit.tower?.toString().trim();

            // 1. Alícuotas publicadas para la torre
            const { data: periods } = await supabase
                .from('condo_periods')
                .select('id, period_name, created_at, unit_aliquot_usd')
                .ilike('tower_id', normalizedTower)
                .eq('status', 'PUBLICADO');

            // 2. Allocations — cuánto se pagó a cada período ordinario
            //    Unimos con unit_payments para obtener fecha/referencia/estatus
            const { data: allocations } = await supabase
                .from('unit_payment_allocations')
                .select(`
                    id,
                    period_id,
                    amount_allocated,
                    unit_payments!inner (
                        id,
                        payment_date,
                        reference,
                        status,
                        amount_usd,
                        unit_id
                    )
                `)
                .eq('unit_payments.unit_id', unit.id);

            // Index allocations by period_id
            const allocByPeriod = {};
            (allocations || []).forEach(a => {
                const pid = a.period_id;
                if (!allocByPeriod[pid]) allocByPeriod[pid] = [];
                allocByPeriod[pid].push({
                    id: a.id,
                    amount: parseFloat(a.amount_allocated || 0),
                    payment_date: a.unit_payments?.payment_date,
                    reference: a.unit_payments?.reference,
                    status: a.unit_payments?.status
                });
            });

            // 3. Build Ledger Components
            const ledgerEntries = [];
            const initialBalance = parseFloat(unit.initial_debt || 0);

            // Entry 1: Initial Debt
            if (Math.abs(initialBalance) > 0.001) {
                ledgerEntries.push({
                    id: 'initial-debt',
                    date: null, // Force first
                    description: 'Saldo Anterior · Arrastre Inicial',
                    cargo: initialBalance > 0 ? initialBalance : 0,
                    abono: initialBalance < 0 ? Math.abs(initialBalance) : 0,
                    type: 'INICIAL'
                });
            }

            // Entry 2: Published Periods (Charges)
            (periods || []).forEach(p => {
                ledgerEntries.push({
                    id: `charge-${p.id}`,
                    date: p.created_at,
                    description: `Alícuota ${p.period_name}`,
                    cargo: parseFloat(p.unit_aliquot_usd || 0),
                    abono: 0,
                    type: 'CARGO',
                    sortDate: new Date(p.created_at).getTime()
                });
            });

            // Entry 3: Payment Data and Distribution
            const { data: allPays } = await supabase
                .from('unit_payments')
                .select('id, payment_date, amount_usd, reference, status')
                .eq('unit_id', unit.id);

            const { data: specialPays } = await supabase
                .from('special_quota_payments')
                .select('unit_payment_id, amount')
                .eq('unit_id', unit.id);

            // Create a map of special payments to subtract from ordinary total
            const specialMap = (specialPays || []).reduce((acc, sp) => {
                if (sp.unit_payment_id) {
                    acc[sp.unit_payment_id] = (acc[sp.unit_payment_id] || 0) + parseFloat(sp.amount || 0);
                }
                return acc;
            }, {});

            // Add Abonos from Allocations
            (allocations || []).forEach(a => {
                ledgerEntries.push({
                    id: `alloc-${a.id}`,
                    date: a.unit_payments?.payment_date,
                    description: `Pago Ref: ${a.unit_payments?.reference || 'N/A'}`,
                    cargo: 0,
                    abono: parseFloat(a.amount_allocated || 0),
                    type: 'ABONO',
                    status: a.unit_payments?.status,
                    sortDate: new Date(a.unit_payments?.payment_date).getTime()
                });
            });

            // Add Abonos from Surplus (Per payment)
            (allPays || []).forEach(p => {
                const totalPaid = parseFloat(p.amount_usd || 0);
                const specForThis = specialMap[p.id] || 0;
                // How much was allocated to ordinary periods for THIS payment specifically
                const allocatedForThis = (allocations || [])
                    .filter(a => a.unit_payments?.id === p.id)
                    .reduce((sum, a) => sum + parseFloat(a.amount_allocated || 0), 0);
                
                // Surplus exists if (Total - Special - OrdinaryAllocated) > 0
                const ordinarySurplus = parseFloat((totalPaid - specForThis - allocatedForThis).toFixed(2));
                
                if (ordinarySurplus > 0.009) {
                    ledgerEntries.push({
                        id: `surplus-${p.id}`,
                        date: p.payment_date,
                        description: `Abono a cuenta · Excedente/Anticipo (Ref: ${p.reference})`,
                        cargo: 0,
                        abono: ordinarySurplus,
                        type: 'ABONO',
                        status: p.status,
                        sortDate: new Date(p.payment_date).getTime()
                    });
                }
            });

            // 4. SORTING & CALCULATION
            const sortedEntries = ledgerEntries.sort((a, b) => {
                if (a.type === 'INICIAL') return -1;
                if (b.type === 'INICIAL') return 1;
                
                const dateA = a.sortDate || 0;
                const dateB = b.sortDate || 0;
                
                if (dateA !== dateB) return dateA - dateB;
                
                // Si coinciden en fecha: Cargos primero, luego Abonos.
                // Excepto si el Abono es un "Inicial" (pero ya manejado arriba).
                if (a.type === 'CARGO' && b.type === 'ABONO') return -1;
                if (a.type === 'ABONO' && b.type === 'CARGO') return 1;
                
                return 0;
            });

            let running = 0;
            const finalRows = sortedEntries.map(entry => {
                if (entry.type === 'INICIAL') {
                    running = entry.cargo - entry.abono;
                } else if (entry.type === 'CARGO') {
                    running += entry.cargo;
                } else {
                    running -= entry.abono;
                }
                running = parseFloat(running.toFixed(2));
                return { ...entry, balance: running };
            });

            setRows([...finalRows].reverse());
            setFinalBalance(running);
        } catch (err) {
            console.error('Error en estado de cuenta:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando estado de cuenta...</div>;

    const isDebt = finalBalance > 0.009;
    const isCredit = finalBalance < -0.009;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Estado de Cuenta</h2>
                    <p className="text-slate-400 text-sm">Libro mayor · Solo alícuotas ordinarias · Pagos especiales excluidos</p>
                </div>
                <div className={`rounded-2xl px-6 py-4 border-2 min-w-[200px] text-center ${isDebt ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800' : isCredit ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                        {isDebt ? 'Saldo Pendiente' : isCredit ? 'Saldo a Favor' : 'Saldo al Día'}
                    </p>
                    <p className={`text-3xl font-black tabular-nums ${isDebt ? 'text-rose-600 dark:text-rose-400' : isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        ${fmt(Math.abs(finalBalance))}
                    </p>
                    {!isDebt && !isCredit && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">✓ Al corriente</p>}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Fecha</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Descripción</th>
                                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-rose-500">Cargo USD</th>
                                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-emerald-600">Abono USD</th>
                                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Saldo USD</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.length > 0 ? rows.map(row => {
                                const isCargo = row.type === 'CARGO' || row.type === 'INICIAL';
                                const isAbono = row.type === 'ABONO';
                                const isPending = row.status === 'PENDING';
                                return (
                                    <tr key={row.id} className={`transition-colors ${isAbono ? 'bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                                            {row.date ? new Date(row.date).toLocaleDateString('es-VE') : '—'}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`font-medium ${isAbono ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {row.description}
                                            </span>
                                            {isPending && isAbono && (
                                                <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                                                    En revisión
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                                            {isCargo ? `$${fmt(row.cargo)}` : '—'}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                                            {isAbono ? `$${fmt(row.abono)}` : '—'}
                                        </td>
                                        <td className={`px-5 py-3 text-right tabular-nums font-black ${row.balance > 0.009 ? 'text-rose-600 dark:text-rose-400' : row.balance < -0.009 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                            ${fmt(row.balance)}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="5" className="px-5 py-12 text-center text-slate-400 italic">No hay movimientos registrados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-4 flex items-center justify-end gap-6">
                    <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Saldo Final</span>
                    <span className={`text-2xl font-black tabular-nums ${isDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        ${fmt(finalBalance)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default OwnerAccountStatement;
