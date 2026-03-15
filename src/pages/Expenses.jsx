import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const PrintPreview = React.lazy(() => import('../components/PrintPreview'));

const Expenses = () => {
    const { activeTowers, loading: towersLoading, lastSelectedTower, setLastSelectedTower } = useTowers();
    const { role } = useAuth();
    const [selectedTower, setSelectedTower] = useState(lastSelectedTower || '');
    const currentMonth = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"][new Date().getMonth()];
    const currentYear = new Date().getFullYear();
    const [period, setPeriod] = useState(`${currentMonth} ${currentYear}`);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [periodId, setPeriodId] = useState(null);
    const [periodStatus, setPeriodStatus] = useState('BORRADOR');
    const [consolidatedData, setConsolidatedData] = useState(null);
    const [bcvRate, setBcvRate] = useState(0);
    const [showPrintPreview, setShowPrintPreview] = useState(false);

    // Set initial tower when towers load
    useEffect(() => {
        if (activeTowers.length > 0 && !selectedTower) {
            const defaultTower = activeTowers.find(t => t.name === lastSelectedTower)?.name || activeTowers[0].name;
            setSelectedTower(defaultTower);
            if (!lastSelectedTower) setLastSelectedTower(defaultTower);
        }
    }, [activeTowers]);

    // Cargar datos reales de Supabase
    const fetchData = async () => {
        if (!selectedTower) return;
        try {
            setLoading(true);

            // 0. Parse period to dates
            const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
            const [pMonth, pYear] = period.split(' ');
            const monthIndex = monthNames.indexOf(pMonth.toUpperCase());
            const firstDay = `${pYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(parseInt(pYear), monthIndex + 1, 0).toISOString().split('T')[0];

            // 1. Start parallel fetches
            const periodPromise = supabase
                .from('condo_periods')
                .select('*')
                .eq('tower_id', selectedTower)
                .eq('period_name', period.toUpperCase())
                .maybeSingle();

            const bankPromise = supabase
                .from('bank_transactions')
                .select('amount, description')
                .gte('transaction_date', firstDay)
                .lte('transaction_date', lastDay);

            const bcvPromise = supabase
                .from('exchange_rates')
                .select('rate_value')
                .lte('rate_date', firstDay)
                .order('rate_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            const [periodRes, bankRes, bcvRes] = await Promise.all([periodPromise, bankPromise, bcvPromise]);

            if (periodRes.error) throw periodRes.error;
            if (bankRes.error) console.error('Error fetching bank commissions:', bankRes.error);

            const periodData = periodRes.data;
            const bankTransactions = bankRes.data;
            const bcvDayOne = bcvRes.data;

            let dbExpenses = [];
            if (periodData) {
                setPeriodId(periodData.id);
                setPeriodStatus(periodData.status);
                setConsolidatedData({
                    total_expenses_usd: periodData.total_expenses_usd,
                    reserve_fund_usd: periodData.reserve_fund_usd,
                    total_to_distribute_usd: periodData.total_to_distribute_usd,
                    unit_aliquot_usd: periodData.unit_aliquot_usd
                });
                setBcvRate(parseFloat(periodData.bcv_rate));

                const { data: expensesData, error: expError } = await supabase
                    .from('period_expenses')
                    .select('*')
                    .eq('period_id', periodData.id);

                if (expError) throw expError;
                dbExpenses = expensesData || [];
            } else {
                setBcvRate(0);
                setPeriodId(null);
                setPeriodStatus('BORRADOR');
                setConsolidatedData(null);
            }

            const COMMISSION_KEYWORDS = ['COMISION', 'COMIS.', 'MANTENIMIENTO DE CUENTA', 'USO DEL CANAL', 'SMS', 'ITF', 'GASTOS ADMINISTRATIVOS', 'CARGO POR MANTENIMIENTO', 'BANCAREA', 'BANCARIA'];

            const rateDayOne = bcvDayOne?.rate_value || bcvRate || 1;

            // 4. Merge Virtual Item: Comisión Bancaria
            // Improved search: normalizamos para ignorar acentos y mayúsculas
            const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

            // Calcular comisiones bancarias desde las transacciones del mes
            const totalCommissionsBs = (bankTransactions || [])
                .filter(t => COMMISSION_KEYWORDS.some(kw => normalize(t.description || '').includes(normalize(kw))))
                .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

            const existingCommIndex = dbExpenses.findIndex(e => {
                const desc = normalize(e.description);
                return COMMISSION_KEYWORDS.some(kw => desc.includes(normalize(kw)));
            });

            let finalExpenses = [...dbExpenses];

            if (totalCommissionsBs > 0) {
                const commissionData = {
                    amount_bs: totalCommissionsBs,
                    amount_usd_at_payment: totalCommissionsBs / rateDayOne,
                    bank_reference: 'ESTADO DE CUENTA',
                    payment_status: 'PAGADO',
                    id: existingCommIndex >= 0 ? dbExpenses[existingCommIndex].id : 'virtual-comm',
                    description: existingCommIndex >= 0 ? dbExpenses[existingCommIndex].description : 'COMISIÓN BANCARIA (SISTEMA)',
                    is_virtual: existingCommIndex < 0
                };

                if (existingCommIndex >= 0) {
                    // Actualizamos el ítem existente preservando su ID y descripción original (monto declarado)
                    finalExpenses[existingCommIndex] = {
                        ...dbExpenses[existingCommIndex],
                        ...commissionData,
                        // Mantenemos el monto presupuestado original ($3.00), pero informamos el pago real
                        description: dbExpenses[existingCommIndex].description
                    };
                } else {
                    // Solo si no existe en la DB, lo agregamos como virtual
                    finalExpenses.push({
                        ...commissionData,
                        amount: totalCommissionsBs / rateDayOne // Si es virtual, el declarado es el mismo que el pagado
                    });
                }
            } else {
                // Si no hay transacciones bancarias, verificamos si hay algún ítem manual que deba ser "auto-enriquecido"
                finalExpenses = dbExpenses.map(e => {
                    const desc = normalize(e.description);
                    const isComm = COMMISSION_KEYWORDS.some(kw => desc.includes(normalize(kw)));
                    if (isComm && (!e.amount_usd_at_payment || e.amount_usd_at_payment === 0) && e.amount_bs > 0) {
                        return {
                            ...e,
                            amount_usd_at_payment: (parseFloat(e.amount_bs) || 0) / rateDayOne,
                            bank_reference: e.bank_reference || 'CÁLCULO AUTO'
                        };
                    }
                    return e;
                });
            }

            setExpenses(finalExpenses);

        } catch (err) {
            console.error('Error fetching expenses dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedTower, period]);

    // Cálculos estadísticos
    const stats = useMemo(() => {
        const total = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
        const pending = expenses
            .filter(exp => exp.payment_status !== 'PAGADO')
            .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
        const paidCount = expenses.filter(exp => exp.payment_status === 'PAGADO').length;
        const totalCount = expenses.length;
        const budgetUsed = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
        const totalBs = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount_bs) || 0), 0);
        const totalPaidUsd = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount_usd_at_payment) || 0), 0);

        return { total, pending, budgetUsed, paidCount, pendingCount: totalCount - paidCount, totalBs, totalPaidUsd };
    }, [expenses]);

    // Datos para el gráfico (Categorías)
    const chartData = useMemo(() => {
        if (expenses.length === 0) return [];
        // Agrupar por descripción (o categoría si la tuviéramos, usaremos descripción por ahora)
        return expenses.sort((a, b) => b.amount - a.amount).slice(0, 3);
    }, [expenses]);

    return (
        <div className="space-y-10">
            {/* Header Section - Glassmorphism Card */}
            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/40 dark:border-slate-800/40 shadow-2xl shadow-slate-200/50 dark:shadow-none flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Control Financiero · En Vivo</p>
                    </div>
                    <h1 className="text-4xl font-display-bold text-slate-900 dark:text-white tracking-tight">Pagos y Recibos</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">{BUILDING_CONFIG.fullName}</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-10 relative z-10">
                    <div className="text-center sm:text-left">
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Total Ejecutado Torre {selectedTower}</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-slate-400 text-xl font-medium">$</span>
                            <h3 className="text-5xl font-display-bold text-slate-900 dark:text-white tracking-tighter">
                                {formatCurrency(consolidatedData?.total_expenses_usd ?? stats.total)}
                            </h3>
                        </div>
                    </div>

                    <div className="h-16 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

                    <div className="space-y-3">
                        <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                    <span className="material-icons text-sm">payments</span>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-widest leading-none mb-1">Cuota de Condominio</p>
                                    <p className="text-base font-display-bold text-slate-900 dark:text-white leading-none">
                                        $ {formatCurrency(consolidatedData?.unit_aliquot_usd ?? (stats.total / 16))}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {consolidatedData?.reserve_fund_usd > 0 ? (
                            <div className="flex items-center gap-2 px-2">
                                <span className="material-icons text-slate-400 text-sm">account_balance</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    Fondo Reserva: $ {formatCurrency(consolidatedData.reserve_fund_usd)}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Selectors Tray */}
            <div className="flex flex-wrap items-center gap-4 bg-white/40 dark:bg-slate-900/20 backdrop-blur-sm p-4 rounded-[2rem] border border-white/20 dark:border-slate-800/20 w-fit mx-auto">
                <div className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 group hover:border-emerald-500/50 transition-all">
                    <span className="material-icons text-emerald-500 text-lg group-hover:scale-110 transition-transform">apartment</span>
                    <select
                        value={selectedTower}
                        onChange={(e) => {
                            setSelectedTower(e.target.value);
                            setLastSelectedTower(e.target.value);
                        }}
                        className="bg-transparent border-none focus:ring-0 text-sm font-display-bold p-0 pr-8 text-slate-900 dark:text-white outline-none cursor-pointer"
                    >
                        {activeTowers.map(t => (
                            <option key={t.name} value={t.name}>Torre {t.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 group hover:border-emerald-500/50 transition-all">
                    <span className="material-icons text-emerald-500 text-lg group-hover:scale-110 transition-transform">calendar_today</span>
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm font-display-bold p-0 pr-8 text-slate-900 dark:text-white outline-none cursor-pointer"
                    >
                        <option>DICIEMBRE 2025</option>
                        <option>ENERO 2026</option>
                        <option>FEBRERO 2026</option>
                        <option>MARZO 2026</option>
                    </select>
                </div>
            </div>

            {/* KPI Section */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    {
                        label: 'Gastos del Mes (Total)',
                        value: `$ ${formatCurrency(stats.total)}`,
                        icon: 'payments',
                        color: 'bg-emerald-500',
                        bg: 'bg-emerald-500/10'
                    },
                    {
                        label: 'Facturas por Pagar',
                        value: `$ ${formatCurrency(stats.pending)}`,
                        icon: 'receipt_long',
                        color: 'bg-amber-500',
                        bg: 'bg-amber-500/10',
                        sub: `${stats.pendingCount} servicios esperan pago`
                    },
                    {
                        label: 'Ejecución de Pagos',
                        value: `${stats.budgetUsed.toFixed(0)}%`,
                        icon: 'analytics',
                        color: 'bg-blue-500',
                        bg: 'bg-blue-500/10',
                        sub: `${stats.paidCount} de ${expenses.length} gastos pagados`,
                        progress: stats.budgetUsed
                    }
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md p-8 rounded-[2rem] border border-white/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/40 dark:shadow-none relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-6">
                            <div className={`w-14 h-14 ${kpi.bg} rounded-2xl flex items-center justify-center text-slate-900 dark:text-white group-hover:scale-110 transition-transform`}>
                                <span className={`material-icons text-2xl ${kpi.color.replace('bg-', 'text-')}`}>{kpi.icon}</span>
                            </div>
                            {kpi.progress !== undefined ? (
                                <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`${kpi.color} h-full transition-all duration-1000`} style={{ width: `${kpi.progress}%` }}></div>
                                </div>
                            ) : null}
                        </div>
                        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{kpi.label}</h3>
                        <p className="text-4xl font-display-bold text-slate-900 dark:text-white tracking-tight">{kpi.value}</p>
                        {kpi.sub && <p className="text-[10px] text-slate-400 font-bold mt-3 uppercase tracking-wider">{kpi.sub}</p>}
                    </div>
                ))}
            </section>

            {/* Main Table Section */}
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-white/50 dark:border-slate-800/50 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none flex flex-col">
                <div className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            <h2 className="text-xl font-display-bold text-slate-900 dark:text-white tracking-tight">Relación de Gastos Reales</h2>
                        </div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest pl-4">Torre {selectedTower} · {period}</p>
                    </div>
                    {role !== 'VISOR' && (
                        <Link
                            to="/admin/alicuotas"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:shadow-xl hover:shadow-emerald-500/30 active:scale-95 transition-all flex items-center gap-3"
                        >
                            Parametrizar Mes
                        </Link>
                    )}
                    <button
                        onClick={() => setShowPrintPreview(true)}
                        className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:shadow-xl hover:shadow-black/30 active:scale-95 transition-all flex items-center gap-3"
                    >
                        <span className="material-icons text-base">picture_as_pdf</span>
                        Generar PDF
                    </button>
                </div>

                <div className="max-h-[600px] overflow-y-auto overflow-x-auto custom-scrollbar relative">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl sticky top-0 z-20 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 shadow-sm">
                                <th className="px-10 py-6">Descripción del Gasto</th>
                                <th className="px-6 py-6 text-right">Monto ($)</th>
                                <th className="px-6 py-6 text-right">Pago en Bs</th>
                                <th className="px-6 py-6 text-right">Conv. ($)</th>
                                <th className="px-6 py-6 text-center">Referencia</th>
                                <th className="px-10 py-6 text-right">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 font-display">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-32 text-slate-300 font-display-bold uppercase text-xs tracking-[0.2em] animate-pulse">Sincronizando registros...</td></tr>
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-32 px-10">
                                        <div className="flex flex-col items-center justify-center gap-6 bg-slate-50/50 dark:bg-white/5 p-12 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300 shadow-sm">
                                                <span className="material-icons text-4xl">receipt_long</span>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-slate-500 font-display-bold uppercase tracking-[0.15em] text-sm">Sin recibo proyectado</p>
                                                <p className="text-slate-400 text-xs mt-2 max-w-xs mx-auto">No se han parametrizado los gastos para esta torre y periodo seleccionado.</p>
                                            </div>
                                            {role !== 'VISOR' ? (
                                                <Link
                                                    to="/admin/alicuotas"
                                                    className="px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center gap-3 shadow-sm"
                                                >
                                                    <span className="material-icons text-base">add</span>
                                                    Inicializar Periodo
                                                </Link>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                expenses.map((exp) => (
                                    <tr key={exp.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-all group border-b border-transparent hover:border-emerald-100/50 dark:hover:border-emerald-500/20">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm ${exp.payment_status === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
                                                    <span className="material-icons text-lg font-bold">{exp.payment_status === 'PAGADO' ? 'verified' : 'history'}</span>
                                                </div>
                                                <span className="font-display-bold text-sm text-slate-800 dark:text-slate-100 tracking-tight">{exp.description}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <span className="font-display-bold text-sm text-slate-900 dark:text-white">$ {formatCurrency(exp.amount)}</span>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <span className="text-xs font-bold text-slate-500 font-mono tracking-tight">
                                                {exp.amount_bs ? `Bs. ${formatNumber(exp.amount_bs)}` : '--'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <span className={`px-3 py-1.5 rounded-xl text-xs font-display-bold ${exp.amount_usd_at_payment ? 'bg-emerald-500/10 text-emerald-600' : 'text-slate-300'}`}>
                                                {exp.amount_usd_at_payment ? `$ ${formatCurrency(exp.amount_usd_at_payment)}` : '--'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <span className="text-[10px] font-black text-slate-400 font-mono tracking-[0.2em]">{exp.bank_reference || '--'}</span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${exp.payment_status === 'PAGADO'
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                                                {exp.payment_status || 'PENDIENTE'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {!loading && expenses.length > 0 ? (
                            <tfoot className="sticky bottom-0 z-20 bg-slate-900 dark:bg-black text-white/90 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                                <tr className="font-black text-[10px] uppercase tracking-[0.15em]">
                                    <td className="px-10 py-8 border-r border-white/5">TOTAL ACUMULADO</td>
                                    <td className="px-6 py-8 text-right border-r border-white/5 text-base font-display-bold text-white">$ {formatCurrency(stats.total)}</td>
                                    <td className="px-6 py-8 text-right border-r border-white/5 text-slate-400 font-mono">Bs. {formatNumber(stats.totalBs)}</td>
                                    <td className="px-6 py-8 text-right border-r border-white/5 text-emerald-400 text-sm font-display-bold">$ {formatCurrency(stats.totalPaidUsd)}</td>
                                    <td className="px-6 py-8 text-center border-r border-white/5 text-slate-600">--</td>
                                    <td className="px-10 py-8 text-right">
                                        <div className="flex flex-col items-end">
                                            {stats.pendingCount > 0 ? (
                                                <>
                                                    <span className="text-amber-400">{stats.pendingCount} FACTURAS POR LIQUIDAR</span>
                                                    <span className="text-[8px] text-white/40 mt-1">$ {formatCurrency(stats.pending)} RESTANTE</span>
                                                </>
                                            ) : (
                                                <span className="text-emerald-400 flex items-center gap-2">
                                                    <span className="material-icons text-sm">verified</span>
                                                    PERIODO LIQUIDADO
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        ) : null}
                    </table>
                </div>
            </div>

            {/* Distribution and Insights Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-white/50 dark:border-slate-800/50 p-10 shadow-xl overflow-hidden relative group">
                    <h2 className="text-xl font-display-bold text-slate-900 dark:text-white tracking-tight mb-2">Análisis de Distribución</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Participación por rubros principales</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
                        <div className="relative w-48 h-48 mx-auto">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <path
                                    className="stroke-slate-100 dark:stroke-slate-800"
                                    strokeWidth="3.5"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                    className="stroke-emerald-500"
                                    strokeWidth="3.5"
                                    strokeDasharray={`${stats.budgetUsed}, 100`}
                                    strokeLinecap="round"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-display-bold text-slate-900 dark:text-white leading-none">{stats.budgetUsed.toFixed(0)}%</span>
                                <span className="text-[9px] uppercase text-slate-400 font-black tracking-widest mt-2">Pagado</span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {chartData.length > 0 ? chartData.map((exp, idx) => (
                                <div key={exp.id} className="group/item">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-emerald-500' : idx === 1 ? 'bg-teal-500' : 'bg-cyan-500'} shadow-lg shadow-current/20`}></div>
                                            <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide truncate max-w-[120px]">{exp.description}</span>
                                        </div>
                                        <span className="text-xs font-display-bold text-slate-900 dark:text-white">$ {formatCurrency(exp.amount)}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${idx === 0 ? 'bg-emerald-500' : idx === 1 ? 'bg-teal-500' : 'bg-cyan-500'} transition-all duration-1000`}
                                            style={{ width: `${(exp.amount / stats.total) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">Pendiente por cargar</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-8">
                    <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-[2.5rem] p-10 text-white flex flex-col justify-between overflow-hidden relative shadow-2xl shadow-emerald-500/30 group">
                        {/* Decorative Icons */}
                        <div className="absolute right-0 top-0 p-10 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                            <span className="material-symbols-outlined text-[10rem]">verified_user</span>
                        </div>

                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                                <span className="material-icons">security</span>
                            </div>
                            <h4 className="text-2xl font-display-bold tracking-tight">Transparencia Operativa</h4>
                            <p className="text-emerald-50/70 text-sm mt-3 max-w-sm font-medium leading-relaxed">
                                Este panel garantiza el 100% de trazabilidad en los gastos de la Torre {selectedTower}. Cada centavo es auditado y reflejado en tiempo real.
                            </p>
                        </div>

                        <div className="flex items-center gap-4 mt-10 relative z-10">
                            <div className="bg-white text-emerald-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Certificado</div>
                            <p className="text-[10px] text-emerald-100/60 font-medium uppercase tracking-[0.2em]">Palma Real · Live Suite</p>
                        </div>
                    </div>

                    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/50 dark:border-slate-800/50 rounded-[2.5rem] p-10 flex items-center gap-8 shadow-xl relative group">
                        <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 group-hover:scale-105 transition-all duration-500">
                            <span className="material-symbols-outlined text-4xl">history_edu</span>
                        </div>
                        <div>
                            <h4 className="font-display-bold text-lg text-slate-900 dark:text-white tracking-tight leading-none mb-2">Relación de Proveedores</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                Los cargos registrados impactan la solvencia del condominio. Asegúrese de validar cada recibo contra el estado de cuenta.
                            </p>
                            <div className="flex items-center gap-2 mt-4">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-[0.2em]">Sincronización Activa</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Preview Modal */}
            <PrintPreview
                isOpen={showPrintPreview}
                onClose={() => setShowPrintPreview(false)}
                type="gastos_reales"
                data={{
                    selectedTower,
                    period,
                    expenses,
                    finalTotal: consolidatedData?.total_expenses_usd ?? stats.total,
                    totalPaidUsd: stats.totalPaidUsd,
                    aliquotPerUnit: consolidatedData?.unit_aliquot_usd ?? (stats.total / 16),
                    reserveFundAmount: consolidatedData?.reserve_fund_usd ?? 0
                }}
            />
        </div>
    );
};

export default Expenses;
