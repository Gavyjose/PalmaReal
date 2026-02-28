import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { formatCurrency } from '../utils/formatters';

const Reports = () => {
    const { activeTowers, loading: towersLoading, lastSelectedTower, setLastSelectedTower } = useTowers();
    const systemMonth = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"][new Date().getMonth()];
    const systemYear = String(new Date().getFullYear());
    const [month, setMonth] = useState(systemMonth);
    const [year, setYear] = useState(systemYear);
    const [selectedTower, setSelectedTower] = useState(lastSelectedTower || 'Todas las Torres');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        income: 0,
        expenses: 0,
        collectionRate: 0,
        totalDebt: 0,
        debtorUnits: 0,
        totalUnits: 0
    });
    const [towerDebtDistribution, setTowerDebtDistribution] = useState({});
    const [solventUnits, setSolventUnits] = useState([]);

    const months = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];

    const years = ['2025', '2026', '2027'];
    const towers = useMemo(() => ['Todas las Torres', ...activeTowers.map(t => t.name)], [activeTowers]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const periodNameFilter = `${month} ${year}`;

            // 1. Obtener Periodos con sus gastos (Filtrados por mes/año y torre si aplica)
            let periodsQuery = supabase
                .from('condo_periods')
                .select(`
                    id, 
                    tower_id, 
                    status,
                    reserve_fund,
                    period_expenses(amount)
                `)
                .eq('period_name', periodNameFilter);

            if (selectedTower !== 'Todas las Torres') {
                periodsQuery = periodsQuery.eq('tower_id', selectedTower);
            }

            const { data: periodsData } = await periodsQuery;
            console.log('🔍 DEBUG Reports - Period Filter:', periodNameFilter);
            console.log('🔍 DEBUG Reports - Tower Filter:', selectedTower);
            console.log('🔍 DEBUG Reports - Periods Found:', periodsData);

            // Calcular total_aliquot dinámicamente para cada periodo
            const periodsWithAliquot = (periodsData || []).map(period => {
                const totalExpenses = (period.period_expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
                const total_aliquot = totalExpenses + (period.reserve_fund || 0);
                return {
                    ...period,
                    total_aliquot
                };
            });

            // 2. Calcular Egresos totales del periodo seleccionado
            const totalExpenses = periodsWithAliquot.reduce((sum, p) => {
                const expenses = (p.period_expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                return sum + expenses;
            }, 0);

            console.log('🔍 DEBUG Reports - Periods with Aliquot:', periodsWithAliquot);
            console.log('🔍 DEBUG Reports - Total Expenses:', totalExpenses);

            // 3. Obtener Unidades (para morosidad)
            let unitsQuery = supabase.from('units').select('id, tower, owner_id, owners(full_name)');
            if (selectedTower !== 'Todas las Torres') {
                unitsQuery = unitsQuery.eq('tower', selectedTower);
            }

            const { data: unitsData } = await unitsQuery;

            // 4. Calcular Deuda Total (Basada en TODOS los periodos PUBLICADOS)
            let allPublishedQuery = supabase
                .from('condo_periods')
                .select(`
                    id, 
                    tower_id,
                    reserve_fund,
                    period_expenses(amount)
                `)
                .eq('status', 'PUBLICADO');

            if (selectedTower !== 'Todas las Torres') {
                allPublishedQuery = allPublishedQuery.eq('tower_id', selectedTower);
            }

            const { data: allPublishedPeriods } = await allPublishedQuery;

            // Calcular total_aliquot para periodos publicados
            const publishedWithAliquot = (allPublishedPeriods || []).map(period => {
                const expenses = (period.period_expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
                const total_aliquot = expenses + (period.reserve_fund || 0);
                return {
                    ...period,
                    total_aliquot
                };
            });

            // Calcular deuda total por torre (no por unidad)
            // La deuda de la torre es la suma de todos los periodos publicados
            const towerDebtsMap = {};

            publishedWithAliquot.forEach(period => {
                if (!towerDebtsMap[period.tower_id]) {
                    towerDebtsMap[period.tower_id] = 0;
                }
                towerDebtsMap[period.tower_id] += period.total_aliquot;
            });

            // Calcular deuda global y unidades deudoras
            let globalDebt = 0;
            let debtorCount = 0;
            const solventList = [];
            const UNITS_PER_TOWER = 16;

            // Para el conteo de unidades deudoras, asumimos que todas las unidades deben
            (unitsData || []).forEach(unit => {
                const towerPeriods = publishedWithAliquot.filter(p => p.tower_id === unit.tower);
                const unitDebt = towerPeriods.reduce((sum, p) => {
                    const aliquotPerUnit = (p.total_aliquot || 0) / UNITS_PER_TOWER;
                    return sum + aliquotPerUnit;
                }, 0);

                if (unitDebt > 0) {
                    debtorCount++;
                } else {
                    const currentPeriodAliquot = periodsWithAliquot.find(p => p.tower_id === unit.tower);
                    const aliquotPerUnit = currentPeriodAliquot ? (currentPeriodAliquot.total_aliquot / UNITS_PER_TOWER) : 0;
                    solventList.push({
                        id: unit.id,
                        name: unit.owners?.full_name || 'Sin Nombre',
                        amount: aliquotPerUnit
                    });
                }
            });

            // La deuda global es la suma de todas las torres
            globalDebt = Object.values(towerDebtsMap).reduce((sum, debt) => sum + debt, 0);

            // 5. Calcular Ingresos Proyectados (Sumatoria de alícuotas del mes seleccionado)
            const projectedIncome = periodsWithAliquot
                .filter(p => p.status === 'PUBLICADO')
                .reduce((sum, p) => sum + (p.total_aliquot || 0), 0);

            console.log('🔍 DEBUG Reports - Projected Income:', projectedIncome);
            console.log('🔍 DEBUG Reports - Global Debt:', globalDebt);

            setTowerDebtDistribution(towerDebtsMap);
            setSolventUnits(solventList.slice(0, 5));
            setStats({
                income: projectedIncome,
                expenses: totalExpenses,
                collectionRate: unitsData?.length ? ((unitsData.length - debtorCount) / unitsData.length) * 100 : 0,
                totalDebt: globalDebt,
                debtorUnits: debtorCount,
                totalUnits: unitsData?.length || 0
            });

        } catch (err) {
            console.error('Error fetching reports data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [month, year, selectedTower]);

    const towerDistributionArray = useMemo(() => {
        const total = Object.values(towerDebtDistribution).reduce((a, b) => a + b, 0);
        if (total === 0) return [];
        return Object.entries(towerDebtDistribution)
            .map(([tower, debt]) => ({
                tower,
                amount: debt,
                percentage: (debt / total) * 100
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [towerDebtDistribution]);

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto w-full pb-20">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                        <span className="material-icons text-primary">analytics</span>
                        Reportes e Inteligencia Financiera
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Análisis de datos vivos del Condominio Palma Real.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <select
                            value={selectedTower}
                            onChange={(e) => {
                                setSelectedTower(e.target.value);
                                setLastSelectedTower(e.target.value);
                            }}
                            className="bg-transparent border-none text-[10px] font-black focus:ring-0 py-1 pl-3 pr-8 cursor-pointer text-slate-800 dark:text-slate-100 outline-none uppercase tracking-widest"
                        >
                            {towers.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                        <select
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="bg-transparent border-none text-[10px] font-black focus:ring-0 py-1 pl-3 pr-8 cursor-pointer text-slate-800 dark:text-slate-100 outline-none uppercase tracking-widest"
                        >
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                        <select
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            className="bg-transparent border-none text-[10px] font-black focus:ring-0 py-1 pl-3 pr-8 cursor-pointer text-slate-800 dark:text-slate-100 outline-none tracking-widest"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Facturación del Mes</span>
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                            <span className="material-icons text-green-600 dark:text-green-400 text-lg">monetization_on</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">$ {formatCurrency(stats.income)}</span>
                        <span className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-tight">Total alícuotas publicadas</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Gastos del Mes</span>
                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                            <span className="material-icons text-red-600 dark:text-red-400 text-lg">shopping_cart</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">$ {formatCurrency(stats.expenses)}</span>
                        <span className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-tight">Incurridos en el periodo</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Efectividad Operativa</span>
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <span className="material-icons text-primary text-lg">check_circle</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{stats.collectionRate.toFixed(1)}%</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Solvencia</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                            <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${stats.collectionRate}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Cuentas por Cobrar</span>
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
                            <span className="material-icons text-amber-600 dark:text-amber-400 text-lg">priority_high</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">$ {formatCurrency(stats.totalDebt)}</span>
                        <span className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-tight">{stats.debtorUnits} Unidades Pendientes</span>
                    </div>
                </div>
            </div>

            {/* Main Graphs */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight">Balance Mensualizado</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{month} {year}</p>
                        </div>
                        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <div className="flex items-center gap-2 border-b-2 border-primary pb-1">Ingresos</div>
                            <div className="flex items-center gap-2 border-b-2 border-red-400 pb-1">Egresos</div>
                        </div>
                    </div>
                    <div className="h-64 flex items-end justify-around px-4">
                        <div className="flex flex-col items-center gap-4 w-1/4">
                            <div className="w-12 bg-primary rounded-t-xl transition-all" style={{ height: stats.income > 0 ? '80%' : '5%' }}></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facturación</span>
                        </div>
                        <div className="flex flex-col items-center gap-4 w-1/4">
                            <div className="w-12 bg-red-400 rounded-t-xl transition-all" style={{ height: stats.expenses > 0 ? (stats.expenses / (stats.income || stats.expenses || 1) * 80) + '%' : '5%' }}></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gastos</span>
                        </div>
                        <div className="flex flex-col items-center gap-4 w-1/4 opacity-20">
                            <div className="w-12 bg-slate-300 rounded-t-xl h-[10%]"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MES ANT.</span>
                        </div>
                        <div className="flex flex-col items-center gap-4 w-1/4 opacity-20">
                            <div className="w-12 bg-slate-300 rounded-t-xl h-[10%]"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RECAUDADO</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight mb-10">Morosidad por Torre</h3>
                    <div className="space-y-6">
                        {towerDistributionArray.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic">Saneamiento Completo</div>
                        ) : (
                            towerDistributionArray.slice(0, 5).map((item, idx) => (
                                <div key={item.tower}>
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">T. {item.tower}</span>
                                        <span className="text-[10px] font-black text-slate-500">$ {formatCurrency(item.amount)}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${idx === 0 ? 'bg-red-500' : 'bg-primary'}`}
                                            style={{ width: `${item.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight">Top Unidades Solventes</h3>
                </div>
                {loading ? (
                    <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando datos reales...</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/30">
                            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                <th className="px-8 py-5">Unidad</th>
                                <th className="px-8 py-5">Propietario</th>
                                <th className="px-8 py-5">Estado</th>
                                <th className="px-8 py-5 text-right">Contribución</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {solventUnits.length === 0 ? (
                                <tr><td colSpan="4" className="p-10 text-center text-slate-400 italic text-sm">No se encontraron unidades solventes en este periodo.</td></tr>
                            ) : (
                                solventUnits.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                                        <td className="px-8 py-6 font-black text-slate-700 dark:text-slate-300">{u.id}</td>
                                        <td className="px-8 py-6 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight text-sm">{u.name}</td>
                                        <td className="px-8 py-6">
                                            <span className="bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Al Día</span>
                                        </td>
                                        <td className="px-8 py-6 text-right font-black text-slate-900 dark:text-white">$ {formatCurrency(u.amount)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Reports;
