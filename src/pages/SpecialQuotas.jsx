import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { formatNumber } from '../utils/formatters';

const SpecialQuotas = () => {
    const { activeTowers } = useTowers();
    const [selectedTower, setSelectedTower] = useState('A9'); // Default or first active
    const [units, setUnits] = useState([]);
    const [project, setProject] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [newProject, setNewProject] = useState({
        name: '',
        total_budget: '',
        installments_count: 4,
        tower_id: 'A9'
    });
    const [selectedUnitForPayment, setSelectedUnitForPayment] = useState(null);
    const [paymentDetails, setPaymentDetails] = useState({
        amount: '',
        reference: '',
        installment_number: 1
    });

    useEffect(() => {
        fetchData();
    }, [selectedTower]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch units for current tower
            const { data: unitsData } = await supabase
                .from('units')
                .select(`
                    id, 
                    number, 
                    floor, 
                    tower,
                    owners!inner (full_name)
                `)
                .eq('tower', selectedTower)
                .order('floor', { ascending: true })
                .order('number', { ascending: true });

            setUnits(unitsData || []);

            // Fetch the current active project for the selected tower
            const { data: projData } = await supabase
                .from('special_quota_projects')
                .select('*')
                .eq('tower_id', selectedTower)
                .eq('status', 'ACTIVE')
                .limit(1)
                .maybeSingle();

            if (projData) {
                setProject(projData);
                // Fetch payments for this project
                const { data: payData } = await supabase
                    .from('special_quota_payments')
                    .select('*')
                    .eq('project_id', projData.id);
                setPayments(payData || []);
            } else {
                setProject(null);
                setPayments([]);
            }

        } catch (error) {
            console.error('Error fetching special quotas data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProject.name || !newProject.total_budget) {
            alert('Por favor completa el nombre y el presupuesto.');
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('special_quota_projects')
                .insert([{
                    name: newProject.name.toUpperCase(),
                    total_budget: parseFloat(newProject.total_budget),
                    installments_count: parseInt(newProject.installments_count),
                    tower_id: selectedTower,
                    status: 'ACTIVE'
                }])
                .select()
                .single();

            if (error) throw error;

            setProject(data);
            setShowProjectModal(false);
            alert('✅ Proyecto creado exitosamente.');
            fetchData();
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Error al crear proyecto: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterPayment = async () => {
        if (!selectedUnitForPayment || !paymentDetails.amount) {
            alert('Completa los datos del pago.');
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('special_quota_payments')
                .insert([{
                    project_id: project.id,
                    unit_id: selectedUnitForPayment.id,
                    installment_number: parseInt(paymentDetails.installment_number),
                    amount: parseFloat(paymentDetails.amount),
                    reference: paymentDetails.reference.toUpperCase(),
                    payment_date: new Date().toISOString().split('T')[0]
                }]);

            if (error) throw error;

            alert('✅ Pago registrado exitosamente.');
            setShowPaymentModal(false);
            fetchData();
        } catch (error) {
            console.error('Error registering payment:', error);
            alert('Error al registrar pago: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const quotaPerUnit = project ? (project.total_budget / units.length) || 0 : 0;
    const amountPerInstallment = project ? (project.total_budget / (units.length * project.installments_count)) || 0 : 0;
    const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const remainingBudget = project ? project.total_budget - totalCollected : 0;
    const progressPercent = project ? (totalCollected / project.total_budget) * 100 : 0;

    const isPaid = (unitId, installment) => {
        return payments.some(p => p.unit_id === unitId && p.installment_number === installment);
    };

    return (
        <div className="flex flex-col flex-1 max-w-[1400px] mx-auto w-full p-4 lg:p-10 gap-8 min-h-screen animate-fade-in text-slate-800 dark:text-slate-100">
            {/* Page Header */}
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div className="flex flex-col gap-1">
                    <nav className="flex text-xs text-slate-500 dark:text-slate-400 mb-2 gap-2 items-center">
                        <span>Finanzas</span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-primary font-semibold uppercase tracking-wider">Gestión de Cuotas</span>
                    </nav>
                    <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-tight">Presupuestos y Cuotas Especiales</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base italic">Seguimiento financiero para el mantenimiento extraordinario.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Seleccionar Torre</span>
                        <select
                            value={selectedTower}
                            onChange={(e) => setSelectedTower(e.target.value)}
                            className="rounded-lg h-10 px-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm font-bold shadow-sm"
                        >
                            {activeTowers.map(t => <option key={t.name} value={t.name}>Torre {t.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end gap-3">
                        <button className="flex items-center justify-center rounded-lg h-10 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white text-sm font-bold gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all">
                            <span className="material-icons text-lg">download</span>
                            <span>Exportar PDF</span>
                        </button>
                        {project ? (
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                className="flex items-center justify-center rounded-lg h-10 px-6 bg-primary text-white text-sm font-bold gap-2 hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                            >
                                <span className="material-icons text-lg">add_circle</span>
                                <span>Registrar Pago</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowProjectModal(true)}
                                className="flex items-center justify-center rounded-lg h-10 px-6 bg-emerald-600 text-white text-sm font-bold gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all"
                            >
                                <span className="material-icons text-lg">rocket_launch</span>
                                <span>Nuevo Proyecto</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {!project ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center group">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <span className="material-icons text-4xl text-slate-300">account_balance_wallet</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 uppercase">No hay proyectos activos</h3>
                    <p className="text-slate-500 max-w-md mb-8">No se ha iniciado ninguna cuota especial para la Torre {selectedTower} todavía. Crea un nuevo proyecto para empezar el seguimiento.</p>
                    <button
                        onClick={() => setShowProjectModal(true)}
                        className="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
                    >
                        <span className="material-icons">add</span> CONFIGURAR PRIMER PROYECTO
                    </button>
                </div>
            ) : (
                <>
                    {/* Configuration & KPIs */}
                    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Config Panel */}
                        <div className="xl:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-icons text-primary">tune</span>
                                <h3 className="text-lg font-bold">Parámetros del Proyecto</h3>
                            </div>
                            <div className="space-y-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Presupuesto Total (USD)</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                        <input className="form-input w-full pl-8 py-2 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-primary focus:ring-0 font-bold" type="text" value={formatNumber(project.total_budget)} readOnly />
                                    </div>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Número de Cuotas</span>
                                    <div className="px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-bold">
                                        {project.installments_count} Cuotas
                                    </div>
                                </label>
                                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Nombre Proyecto:</span>
                                        <span className="font-bold text-xs truncate max-w-[150px]">{project.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Estado:</span>
                                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-widest">{project.status}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KPI Cards */}
                        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col justify-between rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                    <span className="material-icons text-5xl">payments</span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">Monto por Apartamento</p>
                                <div className="mt-4">
                                    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">${formatNumber(quotaPerUnit)}</p>
                                    <p className="text-xs text-slate-400 mt-1">Total por unidad asignada</p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                    <span className="material-icons text-5xl">calendar_month</span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">Monto por Cuota</p>
                                <div className="mt-4">
                                    <p className="text-3xl font-black text-primary tracking-tight">${formatNumber(amountPerInstallment)}</p>
                                    <p className="text-xs text-slate-400 mt-1">Monto base por mensualidad</p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                    <span className="material-icons text-5xl">account_balance_wallet</span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">Total Recaudado</p>
                                <div className="mt-4">
                                    <p className="text-3xl font-black text-emerald-500 tracking-tight">${formatNumber(totalCollected)}</p>
                                    <p className="text-xs text-slate-400 mt-1">{progressPercent.toFixed(1)}% del presupuesto total</p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                    <span className="material-icons text-5xl">trending_down</span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">Saldo por Cobrar</p>
                                <div className="mt-4">
                                    <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">${formatNumber(remainingBudget)}</p>
                                    <p className="text-xs text-slate-400 mt-1">Faltante para meta presupuestaria</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Dynamic Installments Table */}
                    <section className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-icons text-primary">analytics</span>
                                <h2 className="text-xl font-bold">Matriz de Pagos por Unidad (Torre {selectedTower})</h2>
                            </div>
                            <div className="flex gap-4">
                                <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Pagado
                                </span>
                                <span className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                    <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-200"></span> Pendiente
                                </span>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[480px]">
                            <div className="overflow-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[1000px]">
                                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950 shadow-sm">
                                        <tr className="border-b border-slate-200 dark:border-slate-800">
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Unidad</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Propietario</th>
                                            {[...Array(project.installments_count)].map((_, i) => (
                                                <th key={i} className="px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-center">Cuota {i + 1}</th>
                                            ))}
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-right">Pagado</th>
                                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-right">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {units.map((unit) => {
                                            const unitPayments = payments.filter(p => p.unit_id === unit.id);
                                            const unitPaidAmount = unitPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                                            const unitDebtAmount = quotaPerUnit - unitPaidAmount;

                                            return (
                                                <tr key={unit.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <span className="font-black text-primary text-sm uppercase">Apto {unit.number}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-sm text-slate-900 dark:text-white uppercase truncate max-w-[200px]">{unit.owners?.full_name || 'SIN ASIGNAR'}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Piso {unit.floor}</span>
                                                        </div>
                                                    </td>
                                                    {[...Array(project.installments_count)].map((_, i) => {
                                                        const paid = isPaid(unit.id, i + 1);
                                                        return (
                                                            <td key={i} className="px-4 py-4 text-center">
                                                                {paid ? (
                                                                    <span className="material-icons text-emerald-500 animate-scale-in" title="Pagado">check_circle</span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedUnitForPayment(unit);
                                                                            setPaymentDetails({
                                                                                ...paymentDetails,
                                                                                installment_number: i + 1,
                                                                                amount: amountPerInstallment.toFixed(2)
                                                                            });
                                                                            setShowPaymentModal(true);
                                                                        }}
                                                                        className="material-icons text-slate-200 dark:text-slate-800 hover:text-primary transition-colors cursor-pointer"
                                                                        title="Registrar esta cuota"
                                                                    >
                                                                        radio_button_unchecked
                                                                    </button>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`font-black tabular-nums text-sm ${unitPaidAmount > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                            ${formatNumber(unitPaidAmount)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`font-black tabular-nums text-sm ${unitDebtAmount > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                                                            ${formatNumber(unitDebtAmount)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="sticky bottom-0 z-20 bg-slate-50 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-800 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                                        <tr>
                                            <td className="px-6 py-5 font-black uppercase text-[10px] text-slate-500" colSpan="2">Totales de Recaudación</td>
                                            {[...Array(project.installments_count)].map((_, i) => {
                                                const count = payments.filter(p => p.installment_number === i + 1).length;
                                                return (
                                                    <td key={i} className="px-4 py-5 text-center font-black text-emerald-500 text-xs tabular-nums">
                                                        ${formatNumber(count * amountPerInstallment)}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-6 py-5 text-right font-black text-slate-900 dark:text-white text-xs tabular-nums">${formatNumber(totalCollected)}</td>
                                            <td className="px-6 py-5 text-right font-black text-red-500 text-xs tabular-nums">${formatNumber(remainingBudget)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </section>

                    {/* Transaction Log */}
                    <section className="flex flex-col gap-4 mb-20">
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-primary">history</span>
                            <h2 className="text-xl font-bold">Registro Detallado de Transacciones</h2>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[350px]">
                            <div className="overflow-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 shadow-sm border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Fecha</th>
                                            <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Apartamento</th>
                                            <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Monto</th>
                                            <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Referencia</th>
                                            <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Cuota</th>
                                            <th className="px-6 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {payments.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-bold italic">No hay transacciones registradas para este proyecto aún.</td>
                                            </tr>
                                        ) : (
                                            payments.map(p => (
                                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(p.payment_date).toLocaleDateString('es-VE')}</td>
                                                    <td className="px-6 py-4 font-bold text-sm">Apto {units.find(u => u.id === p.unit_id)?.number}</td>
                                                    <td className="px-6 py-4 tabular-nums font-black text-emerald-500">${formatNumber(p.amount)}</td>
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-400 tracking-widest uppercase">{p.reference || '-'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest">Cuota {p.installment_number}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="text-slate-300 hover:text-primary transition-all">
                                                            <span className="material-icons text-lg">receipt_long</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </>
            )}

            {/* Modal: Nuevo Proyecto */}
            {showProjectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-in">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">Configurar Nuevo Proyecto</h3>
                            <p className="text-sm text-slate-500 mt-1">Define el presupuesto y cuotas para la Torre {selectedTower}.</p>
                        </div>
                        <div className="p-6 space-y-4 text-slate-700 dark:text-slate-300">
                            <label className="flex flex-col gap-2">
                                <span className="text-xs font-black text-slate-500 uppercase">Nombre del Proyecto</span>
                                <input
                                    className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-0 focus:border-primary font-bold text-slate-900 dark:text-white"
                                    placeholder="EJ: PINTURA DE FACHADA"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-xs font-black text-slate-500 uppercase">Presupuesto Total (USD)</span>
                                <input
                                    type="number"
                                    className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-0 focus:border-primary font-bold text-slate-900 dark:text-white"
                                    placeholder="00.00"
                                    value={newProject.total_budget}
                                    onChange={(e) => setNewProject({ ...newProject, total_budget: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-xs font-black text-slate-500 uppercase">Número de Cuotas</span>
                                <select
                                    className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-0 focus:border-primary font-bold text-slate-900 dark:text-white"
                                    value={newProject.installments_count}
                                    onChange={(e) => setNewProject({ ...newProject, installments_count: e.target.value })}
                                >
                                    <option value="1">Pago Único</option>
                                    <option value="2">2 Cuotas</option>
                                    <option value="4">4 Cuotas</option>
                                    <option value="6">6 Cuotas</option>
                                    <option value="12">12 Cuotas</option>
                                </select>
                            </label>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-950/50 flex gap-3">
                            <button
                                onClick={() => setShowProjectModal(false)}
                                className="flex-1 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleCreateProject}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                            >
                                CREAR PROYECTO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Registrar Pago */}
            {showPaymentModal && project && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-in">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">Registrar Pago</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {selectedUnitForPayment ? `Apto ${selectedUnitForPayment.number}` : 'Selecciona una unidad'} · Cuota {paymentDetails.installment_number}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            {!selectedUnitForPayment ? (
                                <label className="flex flex-col gap-2">
                                    <span className="text-xs font-black text-slate-500 uppercase">Seleccionar Unidad</span>
                                    <select
                                        className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-0 focus:border-primary font-bold text-slate-900 dark:text-white"
                                        onChange={(e) => setSelectedUnitForPayment(units.find(u => u.id === e.target.value))}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {units.map(u => <option key={u.id} value={u.id}>Apto {u.number} - {u.owners?.full_name}</option>)}
                                    </select>
                                </label>
                            ) : null}
                            <label className="flex flex-col gap-2">
                                <span className="text-xs font-black text-slate-500 uppercase">Monto Recibido (USD)</span>
                                <input
                                    className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-0 focus:border-primary font-bold text-slate-900 dark:text-white"
                                    type="number"
                                    value={paymentDetails.amount}
                                    onChange={(e) => setPaymentDetails({ ...paymentDetails, amount: e.target.value })}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-xs font-black text-slate-500 uppercase">Referencia Bancaria</span>
                                <input
                                    className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-0 focus:border-primary font-bold text-slate-900 dark:text-white"
                                    placeholder="Opcional"
                                    value={paymentDetails.reference}
                                    onChange={(e) => setPaymentDetails({ ...paymentDetails, reference: e.target.value })}
                                />
                            </label>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-950/50 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setSelectedUnitForPayment(null);
                                }}
                                className="flex-1 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleRegisterPayment}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                            >
                                GUARDAR PAGO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpecialQuotas;

