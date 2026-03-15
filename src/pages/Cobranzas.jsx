import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatNumber } from '../utils/formatters';
const CobranzasReport = React.lazy(() => import('../components/CobranzasReport'));
const QuotaPaymentModal = React.lazy(() => import('../components/QuotaPaymentModal'));
import { sortUnits } from '../utils/unitSort';
import { useTowers } from '../hooks/useTowers';
import { buildFinancialLedger } from '../utils/financialUtils';

const MONTH_MAP = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
};
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
    const { role } = useAuth();

    // Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showTransferDetails, setShowTransferDetails] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [selectedUnitPendingPeriods, setSelectedUnitPendingPeriods] = useState([]);
    const [towerPeriods, setTowerPeriods] = useState([]);
    const [specialProjects, setSpecialProjects] = useState([]);
    const [specialPayments, setSpecialPayments] = useState([]);
    const [allocations, setAllocations] = useState([]);

    const getPreviousPeriodName = (periodName) => {
        if (!periodName) return 'DEUDA ANTERIOR';
        const [month, year] = periodName.split(' ');
        const mIdx = MONTH_MAP[month.toUpperCase()];
        if (mIdx === undefined) return 'DEUDA ANTERIOR';

        const prevMonthIdx = (mIdx - 1 + 12) % 12;
        const prevYear = mIdx === 0 ? parseInt(year) - 1 : year;
        return `${REVERSE_MONTH_MAP[prevMonthIdx]} ${prevYear}`;
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

            // Parallel fetch for periods and rate
            const [periodsRes, rateRes] = await Promise.all([
                supabase.from('condo_periods').select('*').order('created_at', { ascending: false }),
                supabase.from('exchange_rates').select('rate_value').order('rate_date', { ascending: false }).limit(1)
            ]);

            const allPeriods = periodsRes.data || [];
            setPeriods(allPeriods);

            if (allPeriods.length > 0) {
                const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
                const now = new Date();
                const currentPeriodName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

                const found = allPeriods.find(p => p.period_name.toUpperCase() === currentPeriodName);
                setCurrentPeriod(found || allPeriods[0]);
            }

            if (rateRes.data && rateRes.data.length > 0) {
                setBcvRate(rateRes.data[0].rate_value);
            }

        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCollectionData = async () => {
        if (!currentPeriod || !selectedTower) return;

        if (selectedTower !== lastSelectedTower && selectedTower !== 'Todas las Torres') {
            setLastSelectedTower(selectedTower);
        }

        try {
            setLoading(true);

            // Phase 1: Fetch Units and Periods in parallel
            const [unitsRes, periodsRes, specialProjectsRes] = await Promise.all([
                supabase.from('units').select('*, owners(full_name)').eq('tower', selectedTower),
                supabase.from('condo_periods').select('*, period_expenses(amount)').eq('tower_id', selectedTower),
                supabase.from('special_quota_projects').select('*').eq('tower_id', selectedTower).eq('status', 'ACTIVE')
            ]);

            const sortedUnits = sortUnits(unitsRes.data || []);
            const unitIds = sortedUnits.map(u => u.id);

            if (unitIds.length === 0) {
                setUnits([]);
                setPayments([]);
                setTowerPeriods([]);
                setSpecialProjects([]);
                setSpecialPayments([]);
                setAllocations([]);
                return;
            }

            // Phase 2: Fetch Payments and Special payments in parallel
            const [paymentsRes, specialPaymentsRes] = await Promise.all([
                supabase.from('unit_payments').select('*').in('unit_id', unitIds),
                supabase.from('special_quota_payments').select('*').in('unit_id', unitIds)
            ]);

            const payData = paymentsRes.data || [];

            // Phase 3: Allocations (must wait for payments IDs)
            let allocData = [];
            const paymentIds = payData.map(p => p.id);
            if (paymentIds.length > 0) {
                const { data: aData } = await supabase
                    .from('unit_payment_allocations')
                    .select('*')
                    .in('payment_id', paymentIds);
                allocData = aData || [];
            }

            // Process tower periods with computed totals
            const towerPeriodsData = (periodsRes.data || []).sort((a, b) => {
                const [monthA, yearA] = a.period_name.split(' ');
                const [monthB, yearB] = b.period_name.split(' ');
                const mIdxA = MONTH_MAP[monthA?.toUpperCase()] ?? 0;
                const mIdxB = MONTH_MAP[monthB?.toUpperCase()] ?? 0;
                const yA = parseInt(yearA) || 0;
                const yB = parseInt(yearB) || 0;
                return yA !== yB ? yA - yB : mIdxA - mIdxB;
            });

            towerPeriodsData.forEach(p => {
                const expTotal = (p.period_expenses || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                p._computed_total = parseFloat((expTotal + parseFloat(p.reserve_fund || 0)).toFixed(2));
                p._unit_aliquot = parseFloat((p._computed_total / 16).toFixed(2));
            });

            // Update all state at once to prevent partial render issues
            setUnits(sortedUnits);
            setPayments(payData);
            setTowerPeriods(towerPeriodsData);
            setSpecialProjects(specialProjectsRes.data || []);
            setSpecialPayments(specialPaymentsRes.data || []);
            setAllocations(allocData);

        } catch (error) {
            console.error('Error fetching collection data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getUnitMetrics = (unitId) => {
        const u = units.find(un => un.id === unitId);
        if (!u || !currentPeriod) return { predeuda: 0, mesCursoBase: 0, deudaTotal: 0, paidBs: 0, paidUsd: 0, remaining: 0, status: "Pendiente" };

        const [pMonthName, pYear] = currentPeriod.period_name.split(" ");
        const mIdx = MONTH_MAP[pMonthName.toUpperCase()] || 0;
        const currentPeriodSortKey = parseInt(pYear) * 100 + mIdx;
        const startOfMonth = new Date(parseInt(pYear), mIdx, 1);
        const endOfMonth = new Date(parseInt(pYear), mIdx + 1, 0, 23, 59, 59);

        // 1. Ledger for the selected period (to get the balance AT THAT POINT)
        const periodsUpToActive = towerPeriods.filter(p => {
            const pts = p.period_name.split(" ");
            const sk = parseInt(pts[1]) * 100 + (MONTH_MAP[pts[0].toUpperCase()] || 0);
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
            const sk = parseInt(pts[1]) * 100 + (MONTH_MAP[pts[0].toUpperCase()] || 0);
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

    const { filteredUnitsWithMetrics, collectionTotals } = React.useMemo(() => {
        const filtered = units.filter(u =>
            u.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.owners?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
        );

        const unitsWithMetrics = filtered.map(u => {
            const m = getUnitMetrics(u.id);
            return {
                ...u,
                metrics: m,
                // para compatibilidad con el reporte:
                unit_name: u.number,
                owner_name: u.owners?.full_name,
                previous_debt: m.predeuda,
                month_quota: m.mesCursoBase,
                total_debt: m.deudaTotal,
                total_paid: m.paidUsd,
                balance: m.remaining
            };
        });

        const totals = unitsWithMetrics.reduce((acc, u) => {
            const m = u.metrics;
            acc.predeuda += m.predeuda || 0;
            acc.mesCurso += m.mesCursoBase || 0;
            acc.acumulado += m.deudaTotal || 0;
            acc.bs += m.paidBs || 0;
            acc.equivalentUsd += m.paidEquivalentUsd || 0;
            acc.cashUsd += m.paidCashUsd || 0;
            acc.usdTotal += m.paidUsd || 0;
            acc.receivable += m.remaining || 0;
            return acc;
        }, {
            predeuda: 0,
            mesCurso: 0,
            acumulado: 0,
            bs: 0,
            equivalentUsd: 0,
            cashUsd: 0,
            usdTotal: 0,
            receivable: 0
        });

        return { filteredUnitsWithMetrics: unitsWithMetrics, collectionTotals: totals };
    }, [units, payments, currentPeriod, bcvRate, searchTerm, towerPeriods, specialProjects, specialPayments, allocations]);

    const totalCollectedBs = collectionTotals.bs;
    const totalCollectedUsd = collectionTotals.usdTotal; // Legacy variable if needed elsewhere
    const totalCollectedCashUsd = collectionTotals.cashUsd;
    const totalCollectedEquivalentUsd = collectionTotals.equivalentUsd;
    const totalReceivable = collectionTotals.receivable;

    return (
        <div className="flex flex-col flex-1 max-w-[1600px] mx-auto w-full p-4 gap-4">
            {/* Header Section - Financial Ledger Style */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-emerald-50 flex items-center justify-center border border-slate-200">
                            <span className="material-icons text-emerald-600">account_balance_wallet</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Libro de <span className="text-emerald-600">Cobranzas</span>
                            </h1>
                            <p className="text-sm text-slate-500">Gestión Integral de Cartera Bimonetaria</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-sm border border-emerald-200 dark:border-emerald-800">
                            <span className="material-icons text-emerald-500 text-sm">calendar_month</span>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                {currentPeriod?.period_name || 'Sin Período'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-sm border border-slate-200 dark:border-slate-700">
                            <span className="material-icons text-slate-500 text-sm">currency_exchange</span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                TIPO DE CAMBIO: <span className="font-mono">{formatCurrency(bcvRate || 0)} Bs/$</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-sm border border-slate-200 dark:border-slate-700">
                            <span className="material-icons text-slate-400 text-sm">apartment</span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                                TORRE: {selectedTower}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 no-print">
                    <button
                        onClick={() => setShowReport(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md font-bold text-sm hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-icons text-lg">description</span>
                        GENERAR REPORTE
                    </button>
                </div>
            </div>

            {/* Selectors Tray - Financial Ledger Style */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-end no-print">
                <div className="flex-1 min-w-[250px]">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Búsqueda</label>
                    <div className="relative">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors font-medium placeholder:text-slate-400"
                            placeholder="Buscar residente por apartamento o nombre..."
                            type="text"
                        />
                    </div>
                </div>

                <div className="w-64">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Periodo Contable</label>
                    <div className="relative">
                        <select
                            value={currentPeriod?.id || ''}
                            onChange={(e) => setCurrentPeriod(periods.find(p => p.id === e.target.value))}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm font-bold appearance-none cursor-pointer focus:ring-1 focus:ring-slate-900 transition-colors"
                        >
                            {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
                        </select>
                        <span className="material-icons absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-emerald-500 transition-colors">unfold_more</span>
                    </div>
                </div>

                <div className="w-56">
                    <label className="block text-[10px] font-display-bold text-slate-400 uppercase mb-3 ml-2 tracking-[0.2em]">Área de Gestión</label>
                    <div className="relative">
                        <select
                            value={selectedTower}
                            onChange={(e) => setSelectedTower(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 px-5 text-sm font-display-bold appearance-none cursor-pointer focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                        >
                            {activeTowers.map(t => <option key={t.id} value={t.name}>Torre {t.name}</option>)}
                        </select>
                        <span className="material-icons absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors">apartment</span>
                    </div>
                </div>
            </div>

            {/* Premium KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Unidades Solventes', val: `${units.filter(u => getUnitMetrics(u.id).status === 'Solvente').length}`, sub: 'Al día con sus pagos', icon: 'check_circle', color: 'emerald', progress: (units.filter(u => getUnitMetrics(u.id).status === 'Solvente').length / (units.length || 1)) * 100 },
                    { label: 'Índice Morosidad', val: `${formatNumber(units.length > 0 ? (units.filter(u => getUnitMetrics(u.id).status === 'Deudor').length / units.length) * 100 : 0)}%`, sub: 'Unidades con deuda', icon: 'priority_high', color: 'rose', progress: units.length > 0 ? (units.filter(u => getUnitMetrics(u.id).status === 'Deudor').length / units.length) * 100 : 0 },
                    { label: 'Ingresos Divisas', val: `$ ${formatNumber(collectionTotals.usdTotal)}`, sub: 'Recaudación total USD', icon: 'payments', color: 'teal', progress: 85 },
                    { label: 'Cuentas por Cobrar', val: `${collectionTotals.receivable < -0.01 ? '- $' : '$'} ${formatNumber(Math.abs(collectionTotals.receivable))}`, sub: 'Monto total pendiente', icon: 'account_balance', color: 'slate', progress: 30 },
                ].map((stat, i) => (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800">
                        <div className="flex items-start justify-between mb-3">
                            <div className={`w-10 h-10 rounded flex items-center justify-center ${stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : stat.color === 'rose' ? 'bg-red-50 text-red-600' : stat.color === 'teal' ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-600'}`}>
                                <span className="material-icons text-xl">{stat.icon}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">{stat.label}</p>
                                <p className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-1">{stat.val}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500">{stat.sub}</span>
                                <span className={`font-bold ${stat.color === 'emerald' ? 'text-emerald-600' : stat.color === 'rose' ? 'text-red-600' : 'text-slate-600'}`}>{Math.round(stat.progress)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-sm">
                                <div
                                    className={`h-full rounded-sm ${stat.color === 'emerald' ? 'bg-emerald-600' : stat.color === 'rose' ? 'bg-red-500' : stat.color === 'teal' ? 'bg-teal-600' : 'bg-slate-500'}`}
                                    style={{ width: `${stat.progress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Matrix Table - Financial Ledger Style */}
            <div id="printable-report" className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons text-sm">person_search</span>
                                        Unidad & Propietario
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Saldo Ant. ($)</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Mes Curso ($)</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Monto Total ($)</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Pagos Realizados</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Por Cobrar ($)</th>
                                {role !== 'VISOR' && <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500">Gestión</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                                            <p className="text-sm font-bold text-slate-500 uppercase">Cargando...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUnitsWithMetrics.map(u => {
                                const metrics = u.metrics;
                                const isSolvente = metrics.remaining <= 0.1;
                                return (
                                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded flex items-center justify-center font-bold text-sm ${isSolvente ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                                    {u.number}
                                                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isSolvente ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-display-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors uppercase">{u.owners?.full_name || "Sin Asignar"}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isSolvente ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {isSolvente ? 'SOLVENTE' : 'DEUDA PENDIENTE'}
                                                        </span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                                        <span className="text-[10px] text-slate-400 font-medium tracking-tight">Cód: {u.id.substring(0, 4)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right font-mono text-sm">
                                            <span className={`px-2 py-1 rounded-lg ${metrics.predeuda > 0.1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200' : 'text-emerald-500 bg-emerald-500/10'}`}>
                                                {metrics.predeuda < -0.01 ? '- ' : ''}{formatNumber(Math.abs(metrics.predeuda))}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-right font-mono text-sm text-slate-900 dark:text-slate-200">
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold">{formatNumber(metrics.mesCursoBase || 0)}</span>
                                                <span className="text-[9px] text-slate-400 uppercase">Período Actual</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="inline-flex flex-col items-end px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                <span className={`font-mono text-base font-black ${metrics.deudaTotal > 0.1 ? 'text-slate-900 dark:text-white' : 'text-emerald-500'}`}>
                                                    {metrics.deudaTotal < -0.01 ? '- ' : ''}{formatNumber(Math.abs(metrics.deudaTotal))}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-icons text-[14px] text-emerald-500 font-bold">payments</span>
                                                    <span className="text-sm font-display-bold text-emerald-600 dark:text-emerald-400">{formatNumber(metrics.paidBs)} Bs</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium tracking-wide">Equiv: {formatNumber(metrics.paidUsd)} $</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-mono text-base font-black shadow-sm transition-all duration-300 group-hover:scale-105 ${isSolvente ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20'}`}>
                                                {metrics.remaining < -0.01 ? '- ' : ''}{formatNumber(Math.abs(metrics.remaining))}
                                                <span className="text-[10px] font-bold">$</span>
                                            </div>
                                        </td>
                                        {role !== 'VISOR' && (
                                            <td className="px-8 py-6 text-center">
                                                <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                                    <button
                                                        onClick={() => {
                                                            const uMetrics = getUnitMetrics(u.id);
                                                            const pending = uMetrics.fullLedger.rawCharges
                                                                .filter(c => c.status !== 'PAGADO')
                                                                .map(c => ({
                                                                    ...c,
                                                                    amount: parseFloat((c.original_aliquot - c.paid_amount).toFixed(2))
                                                                }));
                                                            setSelectedUnit(u);
                                                            setSelectedUnitPendingPeriods(pending);
                                                            setShowPaymentModal(true);
                                                        }}
                                                        className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/40 relative group/icon"
                                                        title="Registrar Cobro"
                                                    >
                                                        <span className="material-icons text-xl">add_card</span>
                                                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black rounded-lg opacity-0 group-hover/icon:opacity-100 transition-opacity whitespace-nowrap shadow-xl">COBRO RÁPIDO</span>
                                                    </button>
                                                    <button className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-white flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:border-emerald-500 group/hist" title="Ver Histórico">
                                                        <span className="material-icons text-xl group-hover/hist:rotate-[-12deg] transition-transform">history_edu</span>
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* Summary Sticky Footer - Premium Jade Style */}
                        {!loading && (
                            <tfoot className="sticky bottom-0 z-30 bg-slate-900 border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                                <tr className="divide-x divide-white/5">
                                    <td className="px-8 py-8 bg-slate-950/50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                <span className="material-icons text-emerald-500 text-2xl">auto_graph</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 leading-none mb-2">KPI Global</span>
                                                <span className="text-xl font-display-bold text-white uppercase tracking-tight">Consolidado</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-8 text-right font-mono text-2xl font-black text-white/30 hover:text-white/60 transition-colors">
                                        {formatNumber(Math.abs(collectionTotals.predeuda))}
                                    </td>
                                    <td className="px-6 py-8 text-right font-mono text-2xl font-black text-white/30 hover:text-white/60 transition-colors">
                                        {formatNumber(collectionTotals.mesCurso)}
                                    </td>
                                    <td className="px-6 py-8 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Monto Exigible</span>
                                            <span className="font-mono text-3xl font-black text-white">
                                                {formatNumber(Math.abs(collectionTotals.acumulado))}
                                                <span className="text-xs ml-1 text-slate-400 font-display-bold">$</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-8 text-right">
                                        <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-2xl font-black text-emerald-400">{formatNumber(collectionTotals.bs)}</span>
                                                    <span className="text-xs font-black text-emerald-500/50">Bs</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 border-t border-emerald-500/10 pt-1">
                                                    <span className="text-[10px] font-black text-emerald-500/40 uppercase tracking-tighter">Equiv.</span>
                                                    <span className="font-mono text-sm text-emerald-500/60 font-bold">{formatNumber(collectionTotals.usdTotal)} $</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-8 text-right bg-emerald-500/5">
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-lg shadow-rose-500/50"></div>
                                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">Por Recaudar</span>
                                            </div>
                                            <span className="font-mono text-4xl font-black text-white mt-1">
                                                {formatNumber(Math.abs(collectionTotals.receivable))}
                                                <span className="text-xl ml-2 text-emerald-500 font-display-bold">$</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-8 text-center bg-slate-950/80">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group cursor-pointer hover:bg-emerald-500/20 transition-all duration-500">
                                                <span className="material-icons text-emerald-500 text-2xl group-hover:scale-125 transition-transform">insights</span>
                                            </div>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Analytics</span>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* Final Dashboard Info - Glassmorphism Overlay */}
                <div className="p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 flex flex-wrap items-center justify-between gap-10 border-t border-white/5">
                    <div className="flex flex-wrap items-center gap-10">
                        <div className="flex flex-col relative">
                            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 ml-1">Cash In-Flow</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-white font-mono tracking-tight">$ {formatNumber(totalCollectedCashUsd)}</span>
                                <span className="text-[10px] font-bold text-emerald-500/60 uppercase">Efectivo</span>
                            </div>
                        </div>

                        <div className="flex flex-col relative">
                            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-500 to-emerald-500 rounded-full shadow-[0_0_15px_rgba(20,184,166,0.3)]"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 ml-1">Proyección Pendiente</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">$ {formatNumber(totalReceivable)}</span>
                                <span className="text-[10px] font-bold text-emerald-500/40 uppercase">Cartera</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="px-8 py-5 bg-white/5 rounded-[2rem] backdrop-blur-3xl border border-white/10 group hover:bg-emerald-500/5 transition-all duration-500">
                            <div className="flex items-center gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em] block">Efficiency Score</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl font-black text-white leading-none">94.2%</span>
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                            <span className="material-icons text-emerald-500 text-xl font-bold">trending_up</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:flex items-center gap-3 px-6 py-4 bg-slate-950 rounded-2xl border border-white/5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-display-bold text-slate-400 uppercase tracking-widest">Live Sync: ACTIVE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Pago - Rediseñado indirectamente vía Props/Clases */}
            {showPaymentModal && selectedUnit ? (
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
                        fetchCollectionData();
                    }}
                />
            ) : null}
            {/* Report Preview Modal */}
            <CobranzasReport
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                data={{
                    units: filteredUnitsWithMetrics,
                    totals: {
                        due: collectionTotals.predeuda,
                        month: collectionTotals.mesCurso,
                        total: collectionTotals.acumulado,
                        paid: collectionTotals.usdTotal,
                        balance: collectionTotals.receivable
                    },
                    selectedTower: selectedTower,
                    towerId: selectedTower
                }}
            />
        </div>
    );
};


export default Cobranzas;
