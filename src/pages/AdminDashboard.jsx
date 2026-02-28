import React, { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import useSWR from 'swr';
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
        <div className="p-4 lg:p-8 space-y-8 animate-fade-in max-w-[1600px] mx-auto w-full">
            {/* Header with Switcher */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                        Hub Analítico <span className="text-primary italic">Palma Real</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-icons text-xs">auto_graph</span>
                        Visualización de Rendimiento en Tiempo Real
                    </p>
                </div>

                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-sm border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setViewMode('general')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'general' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Visión General
                    </button>
                    <button
                        onClick={() => setViewMode('individual')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'individual' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Visión Individual
                    </button>
                </div>
            </div>

            {/* Selectors Bar */}
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Torre de Control</span>
                    <select
                        value={selectedTower}
                        onChange={(e) => {
                            setSelectedTower(e.target.value);
                            setLastSelectedTower(e.target.value);
                            setSelectedUnitId(null);
                        }}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs p-2 focus:outline-none"
                    >
                        <option value="Todas las Torres">Global (Todas las Torres)</option>
                        {activeTowers.map(t => <option key={t.id} value={t.name}>Torre {t.name}</option>)}
                    </select>
                </div>

                {viewMode === 'individual' && (
                    <div className="flex flex-col gap-1 flex-1 max-w-sm">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Buscar Apartamento</span>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Ej: PH-A o Nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs p-2 pl-8 focus:outline-none"
                            />
                            <span className="material-icons absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">search</span>
                            {searchTerm && filteredUnits.length > 0 && !selectedUnitId && (
                                <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 z-50 max-h-48 overflow-y-auto shadow-xl">
                                    {filteredUnits.slice(0, 10).map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => {
                                                setSelectedUnitId(u.id);
                                                setSearchTerm(`${u.number} - ${u.owners?.full_name || ''}`);
                                            }}
                                            className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-black text-slate-900 dark:text-white">{u.number}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{u.tower}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 truncate">{u.owners?.full_name || 'Sin Propietario'}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {selectedUnitId && (
                                <button
                                    onClick={() => { setSelectedUnitId(null); setSearchTerm(''); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                >
                                    <span className="material-icons text-sm">close</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="ml-auto flex items-center gap-6">
                    <div className="flex flex-col text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tasa BCV Ofic.</span>
                        <span className={`flex items-center gap-1.5 justify-end ${bcvStatus.color}`}>
                            <span className="material-icons text-[10px]">{bcvStatus.icon}</span>
                            <span className="text-[10px] font-mono font-black uppercase tracking-tight">
                                {bcvStatus.label}
                            </span>
                        </span>
                    </div>

                    <div className="flex flex-col text-right border-l border-slate-200 dark:border-slate-800 pl-6">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status del Sistema</span>
                        <span className="flex items-center gap-1 justify-end">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-mono font-black text-slate-700 dark:text-slate-300">ACTIVO</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {viewMode === 'general' ? (
                    <>
                        <div className="bg-white dark:bg-slate-900 border-l-4 border-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Recaudado</p>
                            <h3 className="text-2xl font-black font-mono text-slate-900 dark:text-white">$ {formatNumber(metrics.totalCollected)}</h3>
                            <div className="mt-4 flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-sm uppercase tracking-tighter">Histórico</span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border-l-4 border-red-500 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cartera Morosa</p>
                            <h3 className="text-2xl font-black font-mono text-red-600 dark:text-red-500">$ {formatNumber(metrics.totalDebt)}</h3>
                            <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">Facturación bruta acumulada</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border-l-4 border-primary p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Eficiencia de Cobro</p>
                            <h3 className="text-2xl font-black font-mono text-slate-900 dark:text-white">{metrics.recoveryRate.toFixed(1)}%</h3>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 mt-4">
                                <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${metrics.recoveryRate}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border-l-4 border-slate-400 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Unidades Registradas</p>
                            <h3 className="text-2xl font-black font-mono text-slate-900 dark:text-white">{metrics.totalUnits}</h3>
                            <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">Base de datos de {selectedTower}</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-white dark:bg-slate-900 border-l-4 border-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Saldo Actual</p>
                            <h3 className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                                {unitMetrics ? `$ ${formatNumber(unitMetrics.history.reduce((s, h) => s + (h.deuda - h.pago), 0))}` : '--'}
                            </h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border-l-4 border-emerald-500 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Pagado</p>
                            <h3 className="text-2xl font-black font-mono text-emerald-600">
                                {unitMetrics ? `$ ${formatNumber(unitMetrics.history.reduce((s, h) => s + h.pago, 0))}` : '--'}
                            </h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border-l-4 border-amber-500 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cumplimiento</p>
                            <h3 className="text-2xl font-black font-mono text-amber-600">
                                {unitMetrics ? `${((unitMetrics.history.filter(h => h.pago >= h.deuda - 0.05).length / unitMetrics.history.length) * 100 || 0).toFixed(0)}%` : '--'}
                            </h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border-l-4 border-slate-400 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Antigüedad</p>
                            <h3 className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                                {unitMetrics ? (unitMetrics.history.length > 0 ? unitMetrics.history[0].name.split(' ')[1] : '--') : '--'}
                            </h3>
                        </div>
                    </>
                )}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h4 className="font-black uppercase tracking-widest text-sm text-slate-900 dark:text-white border-b-2 border-primary pb-1">
                            {viewMode === 'general' ? 'Tendencia Financiera Consolidada' : 'Historial de Pagos de la Unidad'}
                        </h4>
                        <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">
                            {viewMode === 'general' ? 'Ingresos vs Gastos' : 'Alícuotas vs Pagos'}
                        </span>
                    </div>

                    <div className="h-[400px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            {viewMode === 'general' ? (
                                <AreaChart data={metrics?.chartData}>
                                    <defs>
                                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
                                        tickFormatter={(v) => `$${v}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '4px', color: '#fff' }}
                                        itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0' }}
                                    />
                                    <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" name="Ingresos ($)" />
                                    <Area type="monotone" dataKey="gastos" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorGastos)" name="Gastos ($)" />
                                </AreaChart>
                            ) : (
                                <BarChart data={unitMetrics?.history}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '4px', color: '#fff' }}
                                    />
                                    <Bar dataKey="deuda" fill="#f1f5f9" radius={[4, 4, 0, 0]} name="Cargos del Mes ($)" />
                                    <Bar dataKey="pago" fill="#10b981" radius={[4, 4, 0, 0]} name="Pagos Recibidos ($)" />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Insight Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900 dark:bg-slate-100 p-8 flex flex-col justify-between border-b-8 border-primary relative overflow-hidden">
                    <div className="relative z-10">
                        <h5 className="text-white dark:text-slate-900 font-black uppercase tracking-widest text-xl mb-2">Proyectar Reporte Anual</h5>
                        <p className="text-slate-400 dark:text-slate-500 font-mono text-sm max-w-md">
                            Genera una simulación del flujo de caja estimado basado en el comportamiento histórico de los últimos 12 meses.
                        </p>
                    </div>
                    <button className="mt-8 bg-primary hover:bg-primary/90 text-white px-8 py-3 font-black uppercase tracking-[0.2em] text-[10px] w-max transition-all">
                        Generar Proyección
                    </button>
                    <span className="material-icons absolute -right-8 -bottom-8 text-white/5 text-[200px] select-none pointer-events-none">auto_graph</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4">
                    <h5 className="font-black uppercase tracking-widest text-xs text-slate-400">Distribución de Cartera</h5>
                    <div className="h-[200px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Solvente', value: metrics?.recoveryRate || 0 },
                                        { name: 'Deudor', value: 100 - (metrics?.recoveryRate || 0) },
                                    ]}
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#10b981" />
                                    <Cell fill="#ef4444" />
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <span className="block text-xl font-black font-mono text-slate-900 dark:text-white">{metrics?.recoveryRate.toFixed(0)}%</span>
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">COBRO</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">Recaudación Lograda</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-900 dark:text-white">$ {formatNumber(metrics?.totalCollected)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">Cartera Pendiente</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-900 dark:text-white">$ {formatNumber(metrics?.totalDebt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
