import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatNumber } from '../utils/formatters';
import { sortUnits } from '../utils/unitSort';
import QuotaPaymentModal from '../components/QuotaPaymentModal';
import { useTowers } from '../hooks/useTowers';
import { buildFinancialLedger } from '../utils/financialUtils';


const Cobranzas = () => {
    const [loading, setLoading] = useState(true);
    const [units, setUnits] = useState([]);
    const [payments, setPayments] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [currentPeriod, setCurrentPeriod] = useState(null);
    const { activeTowers, lastSelectedTower, setLastSelectedTower } = useTowers();
    const [selectedTower, setSelectedTower] = useState(lastSelectedTower || 'A1');
    const [searchTerm, setSearchTerm] = useState('');
    const [bcvRate, setBcvRate] = useState(0);

    // Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [selectedUnitPendingPeriods, setSelectedUnitPendingPeriods] = useState([]);

    const monthMap = {
        'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
        'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
    };
    const reverseMonthMap = Object.entries(monthMap).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});

    const getPreviousPeriodName = (periodName) => {
        if (!periodName) return 'DEUDA ANTERIOR';
        const [month, year] = periodName.split(' ');
        const mIdx = monthMap[month.toUpperCase()];
        if (mIdx === undefined) return 'DEUDA ANTERIOR';

        const prevMonthIdx = (mIdx - 1 + 12) % 12;
        const prevYear = mIdx === 0 ? parseInt(year) - 1 : year;
        return `${reverseMonthMap[prevMonthIdx]} ${prevYear}`;
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (currentPeriod) {
            fetchCollectionData();
        }
    }, [currentPeriod, selectedTower]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            // Fetch periods for the list
            const { data: allPeriods } = await supabase
                .from('condo_periods')
                .select('*')
                .order('created_at', { ascending: false });
            setPeriods(allPeriods || []);

            if (allPeriods && allPeriods.length > 0) {
                const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
                const now = new Date();
                const currentPeriodName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

                const found = allPeriods.find(p => p.period_name.toUpperCase() === currentPeriodName);
                setCurrentPeriod(found || allPeriods[0]);
            }

            const { data: rateData } = await supabase
                .from('exchange_rates')
                .select('rate_value')
                .order('rate_date', { ascending: false })
                .limit(1);
            if (rateData && rateData.length > 0) setBcvRate(rateData[0].rate_value);

        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCollectionData = async () => {
        if (!currentPeriod) return;
        if (!selectedTower) return;
        if (selectedTower !== lastSelectedTower && selectedTower !== 'Todas las Torres') {
            setLastSelectedTower(selectedTower);
        }
        try {
            setLoading(true);
            const { data: unitData } = await supabase
                .from('units')
                .select('*, owners(full_name)')
                .eq('tower', selectedTower);
            const sortedUnits = sortUnits(unitData || []);
            setUnits(sortedUnits);

            const unitIds = sortedUnits.map(u => u.id);
            if (unitIds.length === 0) {
                setPayments([]);
                return;
            }

            // Fetch ALL periods for this tower WITH their expenses (to compute totals)
            const { data: towerPeriodsRaw } = await supabase
                .from('condo_periods')
                .select('*, period_expenses(amount)')
                .eq('tower_id', selectedTower);

            // Sort periods chronologically by name (e.g., "ENERO 2026")
            const towerPeriods = (towerPeriodsRaw || []).sort((a, b) => {
                const [monthA, yearA] = a.period_name.split(' ');
                const [monthB, yearB] = b.period_name.split(' ');
                const mIdxA = monthMap[monthA?.toUpperCase()] ?? 0;
                const mIdxB = monthMap[monthB?.toUpperCase()] ?? 0;
                const yA = parseInt(yearA) || 0;
                const yB = parseInt(yearB) || 0;
                if (yA !== yB) return yA - yB;
                return mIdxA - mIdxB;
            });

            // Compute per-period totals — same formula as AliquotsConfig.jsx
            // total = sum(expenses) + reserve_fund,  aliquot = total / 16
            towerPeriods.forEach(p => {
                const expTotal = (p.period_expenses || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                p._computed_total = parseFloat((expTotal + parseFloat(p.reserve_fund || 0)).toFixed(2));
                p._unit_aliquot = parseFloat((p._computed_total / 16).toFixed(2));
            });

            // Fetch special quota projects for this tower
            const { data: specialProjects } = await supabase
                .from('special_quota_projects')
                .select('*')
                .eq('tower_id', selectedTower)
                .eq('status', 'ACTIVE');

            // Fetch ALL payments for units in this tower (all time)
            const { data: payData } = await supabase
                .from('unit_payments')
                .select('*')
                .in('unit_id', unitIds);

            setPayments(payData || []);

            // Fetch ALL allocations for those payments
            const paymentIds = (payData || []).map(p => p.id);
            let allocData = [];
            if (paymentIds.length > 0) {
                const { data: aData } = await supabase
                    .from('unit_payment_allocations')
                    .select('*')
                    .in('payment_id', paymentIds);
                allocData = aData || [];
            }

            // Fetch special payments
            const { data: specialPayments } = await supabase
                .from('special_quota_payments')
                .select('*')
                .in('unit_id', unitIds);

            window._towerPeriods = towerPeriods;
            window._allAllocations = allocData;
            window._specialProjects = specialProjects || [];
            window._specialPayments = specialPayments || [];
        } catch (error) {
            console.error('Error fetching collection data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getUnitMetrics = (unitId) => {
        const u = units.find(un => un.id === unitId);
        if (!u || !currentPeriod) return { predeuda: 0, mesCursoBase: 0, deudaTotal: 0, paidBs: 0, paidUsd: 0, remaining: 0, status: "Pendiente" };

        const towerPeriods = window._towerPeriods || [];
        const specialProjects = window._specialProjects || [];
        const specialPayments = window._specialPayments || [];

        const [pMonthName, pYear] = currentPeriod.period_name.split(" ");
        const mIdx = monthMap[pMonthName.toUpperCase()] || 0;
        const currentPeriodSortKey = parseInt(pYear) * 100 + mIdx;
        const startOfMonth = new Date(parseInt(pYear), mIdx, 1);
        const endOfMonth = new Date(parseInt(pYear), mIdx + 1, 0, 23, 59, 59);

        // 1. Ledger for the selected period (to get the balance AT THAT POINT)
        const periodsUpToActive = towerPeriods.filter(p => {
            const pts = p.period_name.split(" ");
            const sk = parseInt(pts[1]) * 100 + (monthMap[pts[0].toUpperCase()] || 0);
            return sk <= currentPeriodSortKey;
        });

        // Crucial: Only consider payments performed until the end of this month for the report
        const paymentsProcessed = payments.filter(p => p.unit_id === unitId && new Date(p.payment_date) <= endOfMonth);
        const specialProcessed = specialPayments.filter(p => p.unit_id === unitId && p.payment_date && new Date(p.payment_date) <= endOfMonth);

        const activeLedger = buildFinancialLedger({
            initialDebtValue: u.initial_debt,
            condoPeriods: periodsUpToActive,
            specialProjects: [], // Table is Aliquots Only
            specialPayments: specialProcessed,
            paymentsHistory: paymentsProcessed
        });

        // 2. Ledger for the PREVIOUS period (for "Deuda Hasta...")
        const periodsBefore = periodsUpToActive.filter(p => {
            const pts = p.period_name.split(" ");
            const sk = parseInt(pts[1]) * 100 + (monthMap[pts[0].toUpperCase()] || 0);
            return sk < currentPeriodSortKey;
        });

        const paymentsBefore = payments.filter(p => p.unit_id === unitId && new Date(p.payment_date) < startOfMonth);
        const specialBefore = specialPayments.filter(p => p.unit_id === unitId && p.payment_date && new Date(p.payment_date) < startOfMonth);

        const prevLedger = buildFinancialLedger({
            initialDebtValue: u.initial_debt,
            condoPeriods: periodsBefore,
            specialProjects: [],
            specialPayments: specialBefore,
            paymentsHistory: paymentsBefore
        });

        const predeuda = prevLedger.totalBalance > 0
            ? parseFloat(prevLedger.totalBalance.toFixed(2))
            : -parseFloat(prevLedger.remainingInitialDebt.toFixed(2));

        const mesCursoBase = periodsUpToActive.find(p => p.id === currentPeriod.id)?._unit_aliquot || 0;
        const deudaTotal = parseFloat((predeuda + mesCursoBase).toFixed(2));

        // 3. Monthly Activity (Audit)
        const paymentsInMonth = paymentsProcessed.filter(p => new Date(p.payment_date) >= startOfMonth);
        const specialInMonth = specialProcessed.filter(sp => paymentsInMonth.map(p => p.id).includes(sp.unit_payment_id));

        let paidEquivalentUsd = 0;
        let paidCashUsd = 0;
        let paidBs = 0;

        paymentsInMonth.forEach(p => {
            const specAmount = specialInMonth.filter(sp => sp.unit_payment_id === p.id).reduce((s, sp) => s + parseFloat(sp.amount || 0), 0);
            const specBs = specialInMonth.filter(sp => sp.unit_payment_id === p.id).reduce((s, sp) => s + parseFloat(sp.amount_bs || 0), 0);

            const netUsd = Math.max(0, parseFloat((p.amount_usd - specAmount).toFixed(2)));
            const netBs = Math.max(0, parseFloat((p.amount_bs - specBs).toFixed(2)));

            if ((p.amount_bs || 0) > 0) {
                paidEquivalentUsd += netUsd;
                paidBs += netBs;
            } else {
                paidCashUsd += netUsd;
            }
        });

        const remaining = activeLedger.totalBalance > 0
            ? parseFloat(activeLedger.totalBalance.toFixed(2))
            : -parseFloat(activeLedger.remainingInitialDebt.toFixed(2));

        return {
            predeuda,
            mesCursoBase,
            deudaTotal,
            paidBs,
            paidEquivalentUsd,
            paidCashUsd,
            paidUsd: parseFloat((paidEquivalentUsd + paidCashUsd).toFixed(2)),
            remaining,
            status: remaining <= 0.01 ? "Solvente" : "Deudor",
            fullLedger: activeLedger
        };
    };

    const collectionTotals = React.useMemo(() => {
        return units.reduce((acc, u) => {
            const m = getUnitMetrics(u.id);
            acc.bs += m.paidBs || 0;
            acc.equivalentUsd += m.paidEquivalentUsd || 0;
            acc.cashUsd += m.paidCashUsd || 0;
            acc.usdTotal += m.paidUsd || 0;
            acc.receivable += Math.max(0, m.remaining || 0);
            return acc;
        }, { bs: 0, equivalentUsd: 0, cashUsd: 0, usdTotal: 0, receivable: 0 });
    }, [units, payments, currentPeriod, bcvRate]);

    const totalCollectedBs = collectionTotals.bs;
    const totalCollectedUsd = collectionTotals.usdTotal; // Legacy variable if needed elsewhere
    const totalCollectedCashUsd = collectionTotals.cashUsd;
    const totalCollectedEquivalentUsd = collectionTotals.equivalentUsd;
    const totalReceivable = collectionTotals.receivable;

    return (
        <div className="flex flex-col flex-1 max-w-[1600px] mx-auto w-full p-4 lg:p-8 gap-6 min-h-screen animate-fade-in text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Control de Deuda y Cobranza</h1>
                    <div className="flex items-center gap-4 text-slate-500 text-sm font-mono">
                        <span className="flex items-center gap-1">
                            <span className="material-icons text-sm">calendar_month</span>
                            {currentPeriod?.period_name || 'Seleccione un período'}
                        </span>
                        <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                        <span className="flex items-center gap-1 font-bold text-primary">
                            <span className="material-icons text-sm">trending_up</span>
                            Tasa BCV: {formatNumber(bcvRate || 0)} Bs/$
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-none font-bold text-xs uppercase tracking-widest hover:invert transition-all">
                        <span className="material-icons text-sm">download</span>
                        Exportar Reporte
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-none p-4 flex flex-wrap gap-4 items-center shadow-sm">
                <div className="flex-1 min-w-[240px]">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest">Búsqueda rápida</label>
                    <div className="relative">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-none py-2 pl-10 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white transition-all font-mono"
                            placeholder="Apartamento o propietario..."
                            type="text"
                        />
                    </div>
                </div>
                <div className="w-48">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest">Período de Facturación</label>
                    <select
                        value={currentPeriod?.id || ''}
                        onChange={(e) => setCurrentPeriod(periods.find(p => p.id === e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-none py-2 px-3 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold uppercase transition-all"
                    >
                        {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
                    </select>
                </div>
                <div className="w-40">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1 tracking-widest">Bloque / Torre</label>
                    <select
                        value={selectedTower}
                        onChange={(e) => {
                            setSelectedTower(e.target.value);
                            setLastSelectedTower(e.target.value);
                        }}
                        disabled={loading}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-none py-2 px-3 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono font-bold uppercase"
                    >
                        {activeTowers.map(t => <option key={t.id} value={t.name}>Torre {t.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-none overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-x-auto max-h-[540px] overflow-y-auto custom-scrollbar-thin">
                    <table className="w-full border-collapse text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-20 border-b border-slate-300 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800">Unidad</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 text-center">
                                    DEUDA HASTA {getPreviousPeriodName(currentPeriod?.period_name)}
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 text-center">
                                    {currentPeriod?.period_name || 'MES EN CURSO'}
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 text-center">Acumulado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800">Abonos (Bs)</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800">Equivalente ($)</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 text-center">Efectivo ($)</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 text-center">Saldo Pendiente</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan="8" className="px-6 py-20 text-center animate-pulse font-mono text-sm text-slate-400">Procesando matriz de datos...</td></tr>
                            ) : units.filter(u => u.number.toLowerCase().includes(searchTerm.toLowerCase()) || (u.owners?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())).map(u => {
                                const metrics = getUnitMetrics(u.id);
                                const isSolvente = metrics.remaining <= 0.01;
                                return (
                                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 dark:text-white text-sm uppercase">{u.number}</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter truncate max-w-[150px]">{u.owners?.full_name || "Sin Propietario"}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right bg-slate-50/20">
                                            <span className={`text-sm font-black font-mono ${metrics.predeuda < -0.01 ? "text-emerald-500" : metrics.predeuda > 0.01 ? "text-red-500" : "text-slate-400"}`}>
                                                {formatNumber(Math.abs(metrics.predeuda))} $
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black font-mono text-slate-600 dark:text-slate-300">{formatNumber(metrics.mesCursoBase || 0)} $</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right bg-slate-50/50 dark:bg-slate-800/20">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`text-sm font-black font-mono ${metrics.deudaTotal > 0.01 ? "text-red-500" : metrics.deudaTotal < -0.01 ? "text-emerald-500" : "text-slate-400"}`}>
                                                    {formatNumber(Math.abs(metrics.deudaTotal || 0))} $
                                                </span>
                                                <span className="text-[9px] font-mono text-slate-400 italic">
                                                    {formatNumber(metrics.predeuda)} + {formatNumber(metrics.mesCursoBase)} $
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right font-mono text-sm font-bold">
                                            <span className={(metrics.paidBs || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                                                {formatNumber(metrics.paidBs || 0)} Bs
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right font-mono text-sm font-bold">
                                            <span className={(metrics.paidEquivalentUsd || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                                                {formatNumber(metrics.paidEquivalentUsd || 0)} $
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right font-mono text-sm font-bold bg-slate-50/10">
                                            <span className={(metrics.paidCashUsd || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                                                {formatNumber(metrics.paidCashUsd || 0)} $
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`text-sm font-black font-mono ${metrics.remaining < -0.01 ? "text-emerald-500" : metrics.remaining > 0.01 ? "text-red-500" : "text-slate-500"}`}>
                                                    {formatNumber(Math.abs(metrics.remaining))} $
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {!isSolvente && (
                                                <button
                                                    onClick={async () => {
                                                        const uMetrics = getUnitMetrics(u.id);
                                                        const pending = uMetrics.fullLedger.rawCharges
                                                            .filter(c => c.status !== 'PAGADO')
                                                            .map(c => ({
                                                                ...c,
                                                                amount: parseFloat((c.original_aliquot - c.paid_amount).toFixed(2))
                                                            }));
                                                        setSelectedUnit({
                                                            ...u,
                                                            owners: u.owners // owners already fetched in main query
                                                        });
                                                        setSelectedUnitPendingPeriods(pending);
                                                        setShowPaymentModal(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:invert transition-all"
                                                    title="Asentar Pago"
                                                >
                                                    <span className="material-icons text-[12px]">payments</span>
                                                    PAGAR
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Totals */}
                <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-6 flex flex-col md:flex-row items-center justify-between border-t-4 border-primary">
                    <div className="flex items-center gap-3 mb-4 md:mb-0">
                        <div className="bg-primary p-2">
                            <span className="material-icons text-white">analytics</span>
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Resumen de Cobranza Consolidado</span>
                    </div>
                    <div className="flex flex-wrap gap-8 text-right justify-center md:justify-end">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Recaudado (Bolívares)</span>
                            <span className="text-lg font-black font-mono text-white">Bs. {formatNumber(totalCollectedBs)}</span>
                        </div>
                        <div className="w-[1px] bg-slate-800 self-stretch hidden md:block"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Equivalente ($)</span>
                            <span className="text-lg font-black font-mono text-emerald-400">$ {formatNumber(totalCollectedEquivalentUsd)}</span>
                        </div>
                        <div className="w-[1px] bg-slate-800 self-stretch hidden md:block"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Recaudado (Dólares Efectivo)</span>
                            <span className="text-lg font-black font-mono text-emerald-400">$ {formatNumber(totalCollectedCashUsd)}</span>
                        </div>
                        <div className="w-[1px] bg-slate-800 self-stretch hidden md:block"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Cartera por Cobrar</span>
                            <span className="text-lg font-black font-mono text-white">$ {formatNumber(totalReceivable)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    {
                        label: 'Cobros del Período',
                        val: `${payments.length} Pagos`,
                        icon: 'receipt_long',
                        color: 'text-emerald-500',
                        bg: 'bg-emerald-500/10'
                    },
                    {
                        label: 'Unidades Solventes',
                        val: `${units.filter(u => getUnitMetrics(u.id).status === 'Solvente').length} Aptos`,
                        icon: 'check_circle',
                        color: 'text-primary',
                        bg: 'bg-primary/10'
                    },
                    {
                        label: 'Morosidad Estimada',
                        val: `${formatNumber(units.length > 0 ? (units.filter(u => getUnitMetrics(u.id).status === 'Deudor').length / units.length) * 100 : 0)}%`,
                        icon: 'warning',
                        color: 'text-red-500',
                        bg: 'bg-red-500/10'
                    },
                    {
                        label: 'Tasa Cambio Hoy',
                        val: `${bcvRate} Bs/$`,
                        icon: 'currency_exchange',
                        color: 'text-amber-500',
                        bg: 'bg-amber-500/10'
                    },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-5 border border-slate-300 dark:border-slate-800 flex items-center gap-4 group hover:border-primary transition-colors">
                        <div className={`h-12 w-12 flex items-center justify-center ${stat.bg} ${stat.color} group-hover:bg-primary group-hover:text-white transition-all`}>
                            <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">{stat.val}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Inline Payment Modal */}
            {
                showPaymentModal && selectedUnit && (
                    <QuotaPaymentModal
                        isOpen={showPaymentModal}
                        onClose={() => {
                            setShowPaymentModal(false);
                            setSelectedUnit(null);
                            setSelectedUnitPendingPeriods([]);
                        }}
                        pendingPeriods={selectedUnitPendingPeriods}
                        unit={selectedUnit}
                        onSubmit={() => {
                            // Resync Cobranzas data after successful payment
                            fetchCollectionData();
                            alert('Pago registrado correctamente en línea.');
                        }}
                    />
                )
            }
        </div >
    );
};

export default Cobranzas;
