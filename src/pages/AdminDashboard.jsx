import React, { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import useSWR from 'swr';
import { useAuth } from '../context/AuthContext';
import { sortUnits } from '../utils/unitSort';

// Map for sorting months
const monthMap = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
};

const fetchDashboardData = async ([_, tower]) => {
    // 1. Fetch units
    const { data: units } = await supabase
        .from('units')
        .select('*, owners(full_name)')
        .eq(tower && tower !== 'Todas las Torres' ? 'tower' : 'id', tower && tower !== 'Todas las Torres' ? tower : 'any');

    // Fallback if the query above is too complex for JS logic, better fetch all if "Todas", else specific tower
    const query = supabase.from('units').select('*, owners(full_name)');
    if (tower && tower !== 'Todas las Torres') query.eq('tower', tower);
    const { data: finalUnits } = await query;

    // 2. Fetch all periods with consolidated columns
    const pQuery = supabase.from('condo_periods').select('*, period_expenses(amount)');
    if (tower && tower !== 'Todas las Torres') pQuery.eq('tower_id', tower);
    const { data: periods } = await pQuery;

    // 3. Fetch all payments and allocations
    const { data: payments } = await supabase.from('unit_payments').select('*');
    const { data: allocations } = await supabase.from('unit_payment_allocations').select('*');

    return {
        units: sortUnits(finalUnits || []),
        periods: (periods || []).sort((a, b) => {
            const [mA, yA] = a.period_name.split(' ');
            const [mB, yB] = b.period_name.split(' ');
            if (yA !== yB) return (parseInt(yA) || 0) - (parseInt(yB) || 0);
            return (monthMap[mA?.toUpperCase()] ?? 0) - (monthMap[mB?.toUpperCase()] ?? 0);
        }),
        payments: payments || [],
        allocations: allocations || []
    };
};

const fetchCurrentBcvRate = async () => {
    const { data } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('provider', 'BCV')
        .order('rate_date', { ascending: false })
        .limit(1)
        .single();
    return data;
};

const AdminDashboard = () => {
    const { userRole } = useAuth();
    const { activeTowers, lastSelectedTower, setLastSelectedTower } = useTowers();
    const [selectedTower, setSelectedTower] = useState(lastSelectedTower || (activeTowers[0]?.name || 'Todas las Torres'));
    const [viewMode, setViewMode] = useState('general'); // 'general' or 'individual'
    const [selectedUnitId, setSelectedUnitId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { data, isLoading } = useSWR(['dashboardData', selectedTower], fetchDashboardData);
    const { data: bcvData } = useSWR('currentBcvRate', fetchCurrentBcvRate, { refreshInterval: 300000 }); // Refrescar cada 5 min

    const bcvStatus = useMemo(() => {
        if (!bcvData) return { label: 'CARGANDO...', color: 'text-slate-400', icon: 'sync' };

        const today = new Date();
        const rateDate = new Date(bcvData.rate_date + 'T00:00:00');
        const isToday = today.toDateString() === rateDate.toDateString();
        const isWeekend = today.getDay() === 0 || today.getDay() === 6;

        if (isToday) {
            return { label: `Bs. ${bcvData.rate_value}`, color: 'text-emerald-500', icon: 'check_circle', upToDate: true };
        } else if (isWeekend) {
            return { label: `Bs. ${bcvData.rate_value} (Viernes)`, color: 'text-amber-500', icon: 'event', upToDate: true };
        } else {
            return { label: 'TASA PENDIENTE', color: 'text-red-500', icon: 'warning', upToDate: false };
        }
    }, [bcvData]);

    const metrics = useMemo(() => {
        if (!data) return null;
        const { units, periods, allocations } = data;

        // Compute total billing vs total collection
        let totalExpected = 0;
        let totalCollected = 0;

        // Per-period metrics for chart
        const chartData = periods.map(p => {
            const expTotal = p.total_expenses_usd
                ? parseFloat(p.total_expenses_usd)
                : (p.period_expenses || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);

            const periodBase = p.total_to_distribute_usd
                ? parseFloat(p.total_to_distribute_usd)
                : (expTotal + parseFloat(p.reserve_fund || 0));

            const periodExpected = p.unit_aliquot_usd
                ? (parseFloat(p.unit_aliquot_usd) * units.length)
                : ((periodBase / 16) * units.length);

            const periodAllocated = allocations
                .filter(a => a.period_id === p.id)
                .reduce((s, a) => s + parseFloat(a.amount_allocated || 0), 0);

            totalExpected += periodExpected;
            totalCollected += periodAllocated;

            return {
                name: p.period_name,
                ingresos: parseFloat(periodAllocated.toFixed(2)),
                gastos: parseFloat(expTotal.toFixed(2)),
                meta: parseFloat(periodExpected.toFixed(2))
            };
        });

        // Current Debt
        const totalDebt = Math.max(0, totalExpected - totalCollected);
        const recoveryRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

        return {
            totalCollected,
            totalDebt,
            recoveryRate,
            chartData,
            totalUnits: units.length,
            debtorUnits: units.length // Simplified for now
        };
    }, [data]);

    const unitMetrics = useMemo(() => {
        if (viewMode !== 'individual' || !selectedUnitId || !data) return null;
        const { units, periods, allocations } = data;
        const unit = units.find(u => u.id === selectedUnitId);
        if (!unit) return null;

        const history = periods.map(p => {
            const expTotal = (p.period_expenses || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
            const aliquot = (expTotal + parseFloat(p.reserve_fund || 0)) / 16;
            const paid = allocations
                .filter(a => a.period_id === p.id && a.payment_id) // simplified inner join check
                .reduce((s, a) => s + parseFloat(a.amount_allocated || 0), 0);

            return {
                name: p.period_name,
                deuda: parseFloat(aliquot.toFixed(2)),
                pago: parseFloat(paid.toFixed(2))
            };
        });

        return {
            unit,
            history
        };
    }, [viewMode, selectedUnitId, data]);

    const filteredUnits = useMemo(() => {
        if (!data?.units) return [];
        return data.units.filter(u =>
            u.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.owners?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent animate-spin"></div>
                    <span className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Analizando Datos...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-10 space-y-10 animate-in fade-in duration-700 max-w-[1700px] mx-auto w-full pb-20">
            {/* Header: Social VIVO Style */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <span className="material-icons text-white text-2xl">analytics</span>
                            </div>
                            <div>
                                <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                                    Centro de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Mando</span>
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">Live Connect</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Gestión Social VIVO</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center bg-white dark:bg-slate-900/50 backdrop-blur-md p-1.5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <button
                        onClick={() => setViewMode('general')}
                        className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] transition-all flex items-center gap-2 ${viewMode === 'general' ? 'bg-gradient-to-r from-emerald-800 to-emerald-950 dark:from-emerald-400 dark:to-teal-500 text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <span className="material-icons text-sm">dashboard</span>
                        Global
                    </button>
                    <button
                        onClick={() => setViewMode('individual')}
                        className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] transition-all flex items-center gap-2 ${viewMode === 'individual' ? 'bg-gradient-to-r from-emerald-800 to-emerald-950 dark:from-emerald-400 dark:to-teal-500 text-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <span className="material-icons text-sm">person</span>
                        Unidad
                    </button>
                </div>
            </div>

            {/* Selectors Bar: Social Card Style */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white dark:border-slate-800 shadow-2xl shadow-slate-200/40 dark:shadow-none">
                <div className="lg:col-span-3 space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Seleccionar Torre</label>
                    <div className="relative group">
                        <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm group-focus-within:text-emerald-500 transition-colors">apartment</span>
                        <select
                            value={selectedTower}
                            onChange={(e) => {
                                setSelectedTower(e.target.value);
                                setLastSelectedTower(e.target.value);
                                setSelectedUnitId(null);
                            }}
                            className="w-full pl-11 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option value="Todas las Torres">Todas las Torres</option>
                            {activeTowers.map(t => <option key={t.id} value={t.name}>Torre {t.name}</option>)}
                        </select>
                        <span className="material-icons absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                </div>

                <div className={`lg:col-span-5 transition-all duration-500 ${viewMode === 'individual' ? 'opacity-100 scale-100' : 'opacity-30 pointer-events-none scale-95 blur-[2px]'}`}>
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Buscar Apartamento</label>
                        <div className="relative group">
                            <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm group-focus-within:text-emerald-500 transition-colors">search</span>
                            <input
                                type="text"
                                placeholder="Escribe el nro de apto o nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-12 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                            />
                            {selectedUnitId && (
                                <button
                                    onClick={() => { setSelectedUnitId(null); setSearchTerm(''); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-red-500 flex items-center justify-center transition-all"
                                >
                                    <span className="material-icons text-xs">close</span>
                                </button>
                            )}
                            {searchTerm && filteredUnits.length > 0 && !selectedUnitId && viewMode === 'individual' && (
                                <div className="absolute top-full left-0 w-full mt-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 z-50 max-h-64 overflow-y-auto shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-2">
                                    {filteredUnits.slice(0, 10).map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => {
                                                setSelectedUnitId(u.id);
                                                setSearchTerm(`${u.number} - ${u.owners?.full_name || ''}`);
                                            }}
                                            className="w-full text-left p-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-2xl transition-all border-b border-slate-50 dark:border-slate-800 last:border-0"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-black text-slate-900 dark:text-white">{u.number}</span>
                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">Torre {u.tower}</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">{u.owners?.full_name || 'Sin Propietario'}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex items-center justify-end gap-10">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tasa Oficial BCV</span>
                        <div className={`flex items-center gap-2 justify-end mt-1 ${bcvStatus.color}`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${bcvStatus.upToDate ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                            <span className="text-xl font-black tracking-tighter leading-none">
                                {bcvStatus.label}
                            </span>
                        </div>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden group cursor-help shadow-inner">
                        <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="material-icons text-emerald-500 text-2xl animate-pulse">verified_user</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards: Social VIVO Gradient Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {viewMode === 'general' ? (
                    <>
                        <div className="group relative overflow-hidden bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <span className="material-icons text-3xl">account_balance_wallet</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recaudado</p>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">Entrada de Capital</p>
                                </div>
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">$ {formatNumber(metrics?.totalCollected || 0)}</h3>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-100 flex items-center justify-center"><span className="material-icons text-[10px] text-emerald-500">check</span></div>)}
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Liquidado</span>
                            </div>
                        </div>

                        <div className="group relative overflow-hidden bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <span className="material-icons text-3xl">hourglass_empty</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendiente</p>
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">Cuentas por Cobrar</p>
                                </div>
                            </div>
                            <h3 className="text-4xl font-black text-amber-600 dark:text-amber-500 tracking-tighter">$ {formatNumber(metrics?.totalDebt || 0)}</h3>
                            <div className="mt-4 flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-[9px] font-black uppercase tracking-widest">En Gestión</span>
                            </div>
                        </div>

                        <div className="group relative overflow-hidden bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                                    <span className="material-icons text-3xl">trending_up</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Salud Financiera</p>
                                    <p className="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Ratio de Éxito</p>
                                </div>
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{(metrics?.recoveryRate || 0).toFixed(1)}%</h3>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-4 overflow-hidden p-0.5">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-1000" style={{ width: `${metrics?.recoveryRate || 0}%` }}></div>
                            </div>
                        </div>

                        <div className="group relative overflow-hidden bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center text-white">
                                    <span className="material-icons text-3xl">apartment</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unidades</p>
                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">{selectedTower}</p>
                                </div>
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{metrics?.totalUnits || 0}</h3>
                            <div className="mt-4 flex items-center gap-2">
                                <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black uppercase tracking-widest">Activas</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="group relative overflow-hidden bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white">
                                    <span className="material-icons text-3xl">receipt_long</span>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Exigible</p>
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                                {unitMetrics ? `$ ${formatNumber(unitMetrics.history.reduce((s, h) => s + (h.deuda - h.pago), 0))}` : '--'}
                            </h3>
                        </div>

                        <div className="group relative overflow-hidden bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <span className="material-icons text-3xl">payments</span>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Histórico Pagos</p>
                            </div>
                            <h3 className="text-4xl font-black text-emerald-600 tracking-tighter">
                                {unitMetrics ? `$ ${formatNumber(unitMetrics.history.reduce((s, h) => s + h.pago, 0))}` : '--'}
                            </h3>
                        </div>

                        <div className="group relative overflow-hidden bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
                                    <span className="material-icons text-3xl">verified</span>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cumplimiento</p>
                            </div>
                            <h3 className="text-4xl font-black text-teal-600 tracking-tighter">
                                {unitMetrics ? `${((unitMetrics.history.filter(h => h.pago >= h.deuda - 0.05).length / unitMetrics.history.length) * 100 || 0).toFixed(0)}%` : '--'}
                            </h3>
                        </div>

                        <div className="group relative overflow-hidden bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:-translate-y-2">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                    <span className="material-icons text-3xl">history</span>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período Inicio</p>
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                                {unitMetrics ? (unitMetrics.history.length > 0 ? unitMetrics.history[0].name.split(' ')[1] : '--') : '--'}
                            </h3>
                        </div>
                    </>
                )}
            </div>

            {/* Charts Section: Social Board Style */}
            <div className="grid grid-cols-1 gap-10">
                <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl rounded-[3rem] border border-white dark:border-slate-800 p-10 shadow-3xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
                        <div className="space-y-1">
                            <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                                <div className="w-2 h-8 bg-emerald-600 rounded-full"></div>
                                {viewMode === 'general' ? 'Dinámica Financiera Histórica' : `Análisis: Apartamento ${unitMetrics?.unit?.number}`}
                            </h4>
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-5">
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Recaudado</div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Gastos Reales</div>
                                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-400"></span> Meta Proyectada</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            {['12M', '6M', '3M'].map(t => <button key={t} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${t === '12M' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>)}
                        </div>
                    </div>

                    <div className="h-[450px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {viewMode === 'general' ? (
                                <AreaChart data={metrics?.chartData}>
                                    <defs>
                                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#64748b" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8' }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8' }}
                                        dx={-10}
                                        tickFormatter={(v) => `$${v}`}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: '#10b981', strokeWidth: 2, strokeDasharray: 'none' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', padding: '1.5rem' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: '900', color: '#f8fafc', padding: '4px 0', textTransform: 'uppercase' }}
                                        labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: '900', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                    />
                                    <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorIngresos)" name="Recaudado" />
                                    <Area type="monotone" dataKey="gastos" stroke="#64748b" strokeWidth={4} fillOpacity={1} fill="url(#colorGastos)" name="Gastos Reales" />
                                    <Line type="monotone" dataKey="meta" stroke="#2dd4bf" strokeWidth={2} strokeDasharray="8 8" dot={false} name="Meta Facturación" />
                                </AreaChart>
                            ) : (
                                <BarChart data={unitMetrics?.history}>
                                    <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8' }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8' }}
                                        dx={-10}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9', radius: 12 }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', padding: '1.5rem' }}
                                    />
                                    <Bar dataKey="deuda" fill="#cbd5e1" radius={[12, 12, 0, 0]} name="Cargos del Mes ($)" barSize={40} />
                                    <Bar dataKey="pago" fill="#059669" radius={[12, 12, 0, 0]} name="Pagos Recibidos ($)" barSize={40} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Insight Row: Premium Social Design */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 group relative overflow-hidden bg-slate-900 rounded-[3rem] p-12 flex flex-col justify-between border-slate-800 transition-all hover:shadow-[0_40px_100px_rgba(0,0,0,0.3)]">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_-20%,#3b82f620,transparent)]"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-10">
                        <div className="space-y-4">
                            <h5 className="text-white font-black uppercase tracking-tight text-3xl max-w-sm leading-tight">
                                Optimiza tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Recaudado VIVO</span>
                            </h5>
                            <p className="text-slate-400 font-bold text-sm max-w-sm leading-relaxed">
                                Ejecuta proyecciones de flujo inteligente para el mes de {data?.periods?.[0]?.period_name.split(' ')[1] || 'siguiente período'} basadas en patrones de pago históricos.
                            </p>
                            {userRole !== 'VISOR' && (
                                <div className="flex gap-4 pt-4">
                                    <button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-3 shadow-2xl shadow-emerald-600/30 active:scale-95">
                                        Simular Proyección
                                        <span className="material-icons text-sm">rocket_launch</span>
                                    </button>
                                    <button className="px-8 py-5 rounded-3xl border border-slate-700 text-slate-300 font-black uppercase tracking-[0.1em] text-[10px] hover:bg-slate-800 transition-all active:scale-95">
                                        Auditar Datos
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="hidden md:flex flex-1 justify-end">
                            <div className="w-56 h-56 rounded-[3rem] bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-8 flex flex-col justify-between relative shadow-2xl skew-x-3 -rotate-3 transition-transform group-hover:rotate-0">
                                <span className="material-icons text-emerald-500 text-4xl">auto_awesome</span>
                                <div>
                                    <p className="text-white font-black text-2xl tracking-tighter">$ {formatNumber(metrics?.totalExpected || 0)}</p>
                                    <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">META DE CIERRE</p>
                                </div>
                                <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                                    <span className="material-icons text-sm">trending_up</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <span className="material-icons absolute -right-16 -bottom-16 text-white/[0.03] text-[350px] select-none pointer-events-none rotate-12">insights</span>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white dark:border-slate-800 p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
                    <h5 className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 mb-8 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        Distribución de Salud
                    </h5>

                    <div className="h-[220px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Solvente', value: metrics?.recoveryRate || 0 },
                                        { name: 'Pendiente', value: 100 - (metrics?.recoveryRate || 0) },
                                    ]}
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    <Cell fill="#10b981" className="drop-shadow-lg" />
                                    <Cell fill="#ef4444" opacity={0.3} className="drop-shadow-lg" />
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1rem', color: '#fff' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <span className="block text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{(metrics?.recoveryRate || 0).toFixed(0)}%</span>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1 block">Cobrado</span>
                        </div>
                    </div>

                    <div className="space-y-4 mt-8">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 transition-transform hover:scale-105">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white"><span className="material-icons text-sm">payments</span></div>
                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Liquidado</span>
                            </div>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-500">$ {formatNumber(metrics?.totalCollected)}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 transition-transform hover:scale-105">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white"><span className="material-icons text-sm">history_toggle_off</span></div>
                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Deuda</span>
                            </div>
                            <span className="text-xs font-black text-amber-600 dark:text-amber-500">$ {formatNumber(metrics?.totalDebt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
