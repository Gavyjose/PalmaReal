import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { formatCurrency, formatNumber } from '../utils/formatters';

const Expenses = () => {
    const [selectedTower, setSelectedTower] = useState('');
    const { activeTowers, loading: towersLoading } = useTowers();
    const [period, setPeriod] = useState('ENERO 2026');
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bcvRate, setBcvRate] = useState(0);

    // Set initial tower when towers load
    useEffect(() => {
        if (activeTowers.length > 0 && !selectedTower) {
            setSelectedTower(activeTowers[0].name);
        }
    }, [activeTowers]);

    // Cargar datos reales de Supabase
    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: periodData, error: periodError } = await supabase
                .from('condo_periods')
                .select('*')
                .eq('tower_id', selectedTower)
                .eq('period_name', period.toUpperCase())
                .maybeSingle();

            if (periodError) throw periodError;

            if (periodData) {
                setBcvRate(parseFloat(periodData.bcv_rate));
                const { data: expensesData, error: expError } = await supabase
                    .from('period_expenses')
                    .select('*')
                    .eq('period_id', periodData.id);

                if (expError) throw expError;
                setExpenses(expensesData || []);
            } else {
                setExpenses([]);
                setBcvRate(0);
            }
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
        const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
        const pending = expenses
            .filter(exp => exp.payment_status !== 'PAGADO')
            .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
        const paidCount = expenses.filter(exp => exp.payment_status === 'PAGADO').length;
        const totalCount = expenses.length;
        const budgetUsed = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

        return { total, pending, budgetUsed, paidCount, pendingCount: totalCount - paidCount };
    }, [expenses]);

    // Datos para el gráfico (Categorías)
    const chartData = useMemo(() => {
        if (expenses.length === 0) return [];
        // Agrupar por descripción (o categoría si la tuviéramos, usaremos descripción por ahora)
        return expenses.sort((a, b) => b.amount - a.amount).slice(0, 3);
    }, [expenses]);

    return (
        <div className="p-8 space-y-8 pb-20">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">Pagos y Recibos</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{BUILDING_CONFIG.fullName}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
                        <span className="material-icons text-primary text-sm">apartment</span>
                        <select
                            value={selectedTower}
                            onChange={(e) => setSelectedTower(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-black p-0 pr-8 text-slate-900 dark:text-white outline-none cursor-pointer"
                        >
                            {activeTowers.map(t => (
                                <option key={t.name} value={t.name}>Torre {t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
                        <span className="material-icons text-primary text-sm">calendar_month</span>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-black p-0 pr-8 text-slate-900 dark:text-white outline-none cursor-pointer"
                        >
                            <option>DICIEMBRE 2025</option>
                            <option>ENERO 2026</option>
                            <option>FEBRERO 2026</option>
                            <option>MARZO 2026</option>
                        </select>
                    </div>
                </div>
            </header>

            {/* Summary Statistics Row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            <span className="material-icons">payments</span>
                        </div>
                    </div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Gastos del Mes (Total)</h3>
                    <p className="text-3xl font-black mt-1 text-slate-900 dark:text-white">$ {formatCurrency(stats.total)}</p>
                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-8xl text-slate-100 dark:text-slate-800/50 group-hover:scale-110 transition-transform">monetization_on</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
                            <span className="material-icons">pending_actions</span>
                        </div>
                        {stats.pendingCount > 0 && (
                            <span className="bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">Pendiente</span>
                        )}
                    </div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Facturas por Pagar</h3>
                    <p className="text-3xl font-black mt-1 text-slate-900 dark:text-white">$ {formatCurrency(stats.pending)}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tight">{stats.pendingCount} servicios esperan pago</p>
                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-8xl text-slate-100 dark:text-slate-800/50 group-hover:scale-110 transition-transform">receipt_long</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <span className="material-icons">account_balance_wallet</span>
                        </div>
                        <div className="w-1/2 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${stats.budgetUsed}%` }}></div>
                        </div>
                    </div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Ejecución de Pagos</h3>
                    <p className="text-3xl font-black mt-1 text-slate-900 dark:text-white">{stats.budgetUsed.toFixed(0)}%</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tight">{stats.paidCount} de {expenses.length} gastos pagados</p>
                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-8xl text-slate-100 dark:text-slate-800/50 group-hover:scale-110 transition-transform">analytics</span>
                </div>
            </section>

            {/* Main Grid for Table and Chart */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Vendor Table Section */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Relación de Gastos Reales</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Torre {selectedTower} - {period}</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                    <th className="px-6 py-4">Descripción del Gasto</th>
                                    <th className="px-6 py-4 text-right">Monto USD</th>
                                    <th className="px-6 py-4 text-center">Referencia</th>
                                    <th className="px-6 py-4 text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan="4" className="text-center py-20 text-slate-400 font-bold uppercase text-xs tracking-widest">Cargando datos...</td></tr>
                                ) : expenses.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center py-20 text-slate-400 font-bold uppercase text-xs tracking-widest">No hay gastos registrados para este periodo</td></tr>
                                ) : (
                                    expenses.map((exp) => (
                                        <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${exp.payment_status === 'PAGADO' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <span className="material-icons text-xl">{exp.payment_status === 'PAGADO' ? 'check_circle' : 'receipt'}</span>
                                                    </div>
                                                    <span className="font-black text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">{exp.description}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-black text-sm text-slate-900 dark:text-white">$ {formatCurrency(exp.amount)}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Bs. {formatNumber(exp.amount * bcvRate)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest">{exp.bank_reference || '--'}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${exp.payment_status === 'PAGADO'
                                                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                                    : 'bg-amber-100 text-amber-600 border border-amber-200'}`}>
                                                    {exp.payment_status || 'PENDIENTE'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Distribution Chart Section */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col h-fit">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">Distribución Real</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Participación de gastos este mes</p>

                    <div className="flex flex-col items-center justify-center mb-8">
                        <div
                            className="relative w-[200px] h-[200px] rounded-full shadow-inner flex items-center justify-center"
                            style={{
                                background: 'conic-gradient(#135bec 0% 100%)'
                            }}
                        >
                            <div className="absolute inset-[40px] bg-white dark:bg-slate-900 rounded-full flex flex-col items-center justify-center text-center shadow-lg border-4 border-slate-50 dark:border-slate-800">
                                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-widest leading-none">${stats.total.toFixed(0)}</span>
                                <span className="text-[9px] uppercase text-slate-400 font-black tracking-widest mt-1">Total Gastos</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {chartData.length > 0 ? chartData.map((exp, idx) => (
                            <div key={exp.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-blue-400' : 'bg-blue-300'}`}></div>
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{exp.description}</span>
                                </div>
                                <span className="text-sm font-black text-slate-900 dark:text-white">${formatCurrency(exp.amount)}</span>
                            </div>
                        )) : (
                            <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-10">No hay datos suficientes</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Activity Footer Info */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-8 text-white flex items-center justify-between overflow-hidden relative shadow-xl shadow-primary/20">
                    <div className="relative z-10">
                        <h4 className="text-xl font-black uppercase tracking-tight">Transparencia Total</h4>
                        <p className="text-blue-100 text-sm mt-2 max-w-[320px] font-medium leading-relaxed">Este panel refleja el 100% de los gastos cargados en el sistema de alícuotas de la Torre {selectedTower}.</p>
                    </div>
                    <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl text-white/10 rotate-12">verified_user</span>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex items-center gap-6 shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                        <span className="material-symbols-outlined text-4xl">history_edu</span>
                    </div>
                    <div>
                        <h4 className="font-black text-base text-slate-900 dark:text-white uppercase tracking-tight">Gestión de Proveedores</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">Los pagos registrados aquí impactan directamente en la solvencia del condominio Palma Real.</p>
                        <p className="text-[10px] text-primary font-black mt-2 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                            Sincronizado en tiempo real
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Expenses;
