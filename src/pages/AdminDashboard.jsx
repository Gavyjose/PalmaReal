import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { formatCurrency } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalCollected: 0,
        totalDebt: 0,
        delinquencyRate: 0,
        debtorUnits: 0,
        totalUnits: 0
    });
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTower, setSelectedTower] = useState('Todas las Torres');
    const { activeTowers } = useTowers();
    const towersOptions = useMemo(() => ['Todas las Torres', ...activeTowers.map(t => t.name)], [activeTowers]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Cargar todas las unidades
            const { data: unitsData, error: unitsError } = await supabase
                .from('units')
                .select('*, owners(full_name)')
                .order('tower', { ascending: true })
                .order('floor', { ascending: true })
                .order('number', { ascending: true });
            if (unitsError) throw unitsError;

            // 2. Cargar periodos publicados para calcular deuda
            const { data: periodsData, error: periodsError } = await supabase
                .from('condo_periods')
                .select(`
                    id, 
                    tower_id, 
                    reserve_fund,
                    period_expenses(amount)
                `)
                .eq('status', 'PUBLICADO');
            if (periodsError) throw periodsError;

            // 3. (Simulado por ahora hasta tener tabla de pagos de unidades)
            // Calcularemos la deuda asumiendo que si el periodo está publicado, se genera la deuda.
            // Para este MVP, calcularemos estadísticas globales basadas en la sumatoria de alícuotas publicadas.

            let globalDebt = 0;
            let debtorCount = 0;

            // Mapear unidades con su estado (solvente/deudor)
            const processedUnits = unitsData.map(unit => {
                const unitPeriods = (periodsData || []).filter(p => p.tower_id === unit.tower);

                // Calculate total aliquot for each period (Sum of expenses + reserve fund)
                const debt = unitPeriods.reduce((sum, p) => {
                    const expensesTotal = (p.period_expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                    return sum + expensesTotal + (parseFloat(p.reserve_fund) || 0);
                }, 0);

                if (debt > 0) {
                    globalDebt += debt;
                    debtorCount++;
                }

                return {
                    ...unit,
                    debt,
                    owner_name: unit.owners?.full_name || 'Sin Propietario',
                    status: debt > 0 ? 'DEUDOR' : 'SOLVENTE'
                };
            });

            setUnits(processedUnits);
            setStats({
                totalCollected: 12450.00, // Placeholder hasta tener pagos de unidades
                totalDebt: globalDebt,
                delinquencyRate: unitsData.length > 0 ? (debtorCount / unitsData.length) * 100 : 0,
                debtorUnits: debtorCount,
                totalUnits: unitsData.length
            });

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredUnits = useMemo(() => {
        return units.filter(u => {
            const matchesSearch = (u.id || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.owner_name && u.owner_name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesTower = selectedTower === 'Todas las Torres' || u.tower === selectedTower;
            return matchesSearch && matchesTower;
        });
    }, [units, searchTerm, selectedTower]);

    return (
        <div className="p-8 space-y-8 pb-20">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1 */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center">
                            <span className="material-icons">account_balance_wallet</span>
                        </div>
                        <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded">Ingresos Totales</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider text-[10px]">Total Recaudado</p>
                    <h3 className="text-3xl font-black mt-1 text-slate-800 dark:text-white">$ {formatCurrency(stats.totalCollected)}</h3>
                    <span className="material-icons absolute -right-2 -bottom-2 text-7xl opacity-5 group-hover:scale-110 transition-transform">payments</span>
                </div>

                {/* Card 2 */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center">
                            <span className="material-icons">money_off</span>
                        </div>
                        <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded tracking-tighter">{stats.debtorUnits} Unidades con Deuda</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider text-[10px]">Cartera Morosa</p>
                    <h3 className="text-3xl font-black mt-1 text-slate-800 dark:text-white">$ {formatCurrency(stats.totalDebt)}</h3>
                    <span className="material-icons absolute -right-2 -bottom-2 text-7xl opacity-5 group-hover:scale-110 transition-transform">priority_high</span>
                </div>

                {/* Card 3 */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                            <span className="material-icons">analytics</span>
                        </div>
                        <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded italic">Eficiencia</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider text-[10px]">% de Morosidad</p>
                    <h3 className="text-3xl font-black mt-1 text-slate-800 dark:text-white">{stats.delinquencyRate.toFixed(1)}%</h3>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
                        <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${stats.delinquencyRate}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Filters and Table Container */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none text-slate-700 dark:text-slate-200 transition-all"
                                placeholder="Buscar propietario o apto..."
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            value={selectedTower}
                            onChange={(e) => setSelectedTower(e.target.value)}
                            className="py-2.5 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-slate-700 dark:text-slate-200 font-bold"
                        >
                            {towersOptions.map(t => (
                                <option key={t} value={t}>{t === 'Todas las Torres' ? t : `Torre ${t}`}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">Apartamento</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">Propietario</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">Estado</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">Saldo Pendiente</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase text-xs tracking-widest">Sincronizando datos...</td></tr>
                            ) : filteredUnits.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase text-xs tracking-widest">No se encontraron unidades</td></tr>
                            ) : (
                                filteredUnits.map((unit) => (
                                    <tr key={unit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group cursor-pointer" onClick={() => navigate(`/admin/apartamentos/${unit.id}`)}>
                                        <td className="px-6 py-4">
                                            <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{unit.number}</span>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Torre {unit.tower} • Piso {unit.floor || '--'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] uppercase">
                                                    {(unit.owner_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{unit.owner_name || 'Sin Propietario'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${unit.status === 'SOLVENTE'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                                                : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${unit.status === 'SOLVENTE' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                                                {unit.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-sm font-black ${unit.debt > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                $ {formatCurrency(unit.debt)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary transition-all">
                                                <span className="material-icons text-sm">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Stats */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Mostrando <span className="text-slate-900 dark:text-slate-300">{filteredUnits.length}</span> unidades de un total de {stats.totalUnits}
                    </p>
                </div>
            </div>

            {/* Quick Actions and Highlights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 relative overflow-hidden group shadow-sm flex flex-col justify-between">
                    <div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Estado del Condominio</h4>
                        <p className="text-sm text-slate-500 leading-relaxed max-w-sm">La morosidad actual es del {stats.delinquencyRate.toFixed(1)}%. Se recomienda realizar seguimiento a los apartamentos en estado de deuda crítica.</p>
                    </div>
                    <div className="mt-8 flex items-center gap-4">
                        <div className="flex -space-x-3">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800"></div>
                            ))}
                            <div className="w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 bg-primary text-white flex items-center justify-center text-[10px] font-black">+{stats.debtorUnits}</div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apartamentos con deuda</span>
                    </div>
                </div>

                <div className="bg-primary rounded-2xl p-8 text-white flex flex-col justify-between relative overflow-hidden group shadow-xl shadow-primary/20">
                    <div className="relative z-10">
                        <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Comunicación Directa</h3>
                        <p className="text-primary-100 opacity-90 mb-6 max-w-xs text-sm font-medium">Notifica pagos, asambleas o reparaciones a la comunidad de Palma Real con un solo clic.</p>
                        <button className="bg-white text-primary px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-lg cursor-pointer">
                            <span className="material-icons text-sm">send</span>
                            Enviar Aviso Masivo
                        </button>
                    </div>
                    <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[200px] text-white/10 rotate-12 transition-transform group-hover:rotate-0 duration-1000">campaign</span>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
