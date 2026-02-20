import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { formatCurrency } from '../utils/formatters';
import QuotaPaymentModal from '../components/QuotaPaymentModal';

const monthMap = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
    'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
};

const UnitDetail = () => {
    const { id } = useParams(); // This captures the unit ID (UUID)
    const [unit, setUnit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showInitialDebtModal, setShowInitialDebtModal] = useState(false);
    const [newInitialDebt, setNewInitialDebt] = useState('0');
    const [financials, setFinancials] = useState({
        latestAliquot: 0,
        totalBalance: 0,
        latestPeriodName: '--',
        lastPayment: 0,
        history: []
    });

    useEffect(() => {
        fetchUnitDetails();
    }, [id]);

    const fetchUnitDetails = async () => {
        try {
            setLoading(true);
            // Query unit by unique 'id' column
            const { data, error } = await supabase
                .from('units')
                .select(`
                    *,
                    owners (
                        full_name,
                        email,
                        phone,
                        doc_id
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setUnit(data);

            // Fetch Financials
            if (data) {
                await fetchFinancialData(data.tower, data.id, data.initial_debt);
            }
        } catch (error) {
            console.error('Error fetching unit details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateInitialDebt = async () => {
        try {
            setLoading(true);
            const amount = parseFloat(newInitialDebt) || 0;
            const { error } = await supabase
                .from('units')
                .update({ initial_debt: amount })
                .eq('id', id);

            if (error) throw error;

            setShowInitialDebtModal(false);
            await fetchUnitDetails();
            alert('✅ Deuda inicial actualizada exitosamente.');
        } catch (error) {
            console.error('Error updating initial debt:', error);
            alert('Error al actualizar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchFinancialData = async (tower, unitId, initialDebtValue = 0) => {
        try {
            if (!tower) return;
            const normalizedTower = tower.toString().trim();

            // 1. Fetch published periods for this tower
            const { data: periods, error: periodsError } = await supabase
                .from('condo_periods')
                .select(`
                    id,
                    period_name,
                    reserve_fund,
                    period_expenses (
                        amount
                    )
                `)
                .ilike('tower_id', normalizedTower)
                .eq('status', 'PUBLICADO')
                .order('created_at', { ascending: false });

            if (periodsError) throw periodsError;

            // 2. Fetch payments allocated to these periods for this unit
            const { data: allocations, error: allocationsError } = await supabase
                .from('unit_payment_allocations')
                .select(`
                    amount_allocated,
                    period_id,
                    unit_payments!inner (
                        unit_id
                    )
                `)
                .eq('unit_payments.unit_id', unitId);

            if (allocationsError) throw allocationsError;

            // Map payments by period_id
            const paymentsMap = {};
            if (allocations) {
                allocations.forEach(alloc => {
                    const pid = alloc.period_id;
                    if (!paymentsMap[pid]) paymentsMap[pid] = 0;
                    paymentsMap[pid] += parseFloat(alloc.amount_allocated);
                });
            }

            if (periods && periods.length > 0) {
                // Sort chronologically by period_name (e.g., "FEBRERO 2026")
                const sortedPeriods = [...periods].sort((a, b) => {
                    const partsA = a.period_name.split(' ');
                    const partsB = b.period_name.split(' ');
                    const yearA = parseInt(partsA[1]) || 0;
                    const yearB = parseInt(partsB[1]) || 0;
                    const monthA = monthMap[partsA[0].toUpperCase()] || 0;
                    const monthB = monthMap[partsB[0].toUpperCase()] || 0;

                    if (yearA !== yearB) return yearB - yearA;
                    return monthB - monthA;
                });

                let accumulatedDebt = 0;
                let latestAliquot = 0;
                let latestPeriodName = sortedPeriods.length > 0 ? sortedPeriods[0].period_name : 'N/A';
                const history = [];

                // --- INTEGRACIÓN DE DEUDA HISTÓRICA ---
                const initialDebt = parseFloat(initialDebtValue || 0);
                if (initialDebt > 0) {
                    accumulatedDebt = initialDebt;
                    history.push({
                        id: 'INITIAL_DEBT',
                        period_name: 'SALDO ANTERIOR (DEUDA HISTÓRICA)',
                        total_expenses: 0,
                        aliquot: initialDebt,
                        paid_amount: 0,
                        status: 'DEUDA',
                        type: 'HISTORY',
                        sortKey: 0 // Deuda histórica va después de especiales (que tienen prioridad)
                    });
                }

                sortedPeriods.forEach((period, index) => {
                    const parts = period.period_name.split(' ');
                    const year = parseInt(parts[1]) || 0;
                    const month = monthMap[parts[0].toUpperCase()] || 0;
                    const periodSortKey = year * 100 + month;

                    const totalExpenses = parseFloat(period.period_expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0).toFixed(2));
                    const finalTotal = parseFloat((totalExpenses + parseFloat(period.reserve_fund || 0)).toFixed(2));
                    const aliquot = parseFloat((finalTotal / 16).toFixed(2));

                    // Check payments
                    const paidAmount = paymentsMap[period.id] || 0;
                    const isPaid = paidAmount >= aliquot - 0.05;

                    const status = isPaid ? 'PAGADO' : 'DEUDA';

                    if (!isPaid) {
                        accumulatedDebt = parseFloat((accumulatedDebt + (aliquot - paidAmount)).toFixed(2));
                    }

                    history.push({
                        id: period.id,
                        period_name: period.period_name,
                        total_expenses: finalTotal,
                        aliquot: aliquot,
                        paid_amount: paidAmount,
                        status: status,
                        type: 'CONDO',
                        sortKey: periodSortKey
                    });

                    if (index === 0) {
                        latestAliquot = aliquot;
                    }
                });

                // --- INTEGRACIÓN DE CUOTAS ESPECIALES ---
                // 3. Fetch active special quota projects for this tower
                const { data: specialProjects } = await supabase
                    .from('special_quota_projects')
                    .select('*')
                    .eq('tower_id', normalizedTower)
                    .eq('status', 'ACTIVE');

                if (specialProjects && specialProjects.length > 0) {
                    for (const proj of specialProjects) {
                        // Fetch payments for this project and unit
                        const { data: sPayments } = await supabase
                            .from('special_quota_payments')
                            .select('*')
                            .eq('project_id', proj.id)
                            .eq('unit_id', unitId);

                        const paidInstallments = (sPayments || []).map(p => p.installment_number);
                        const amountPerInstallment = parseFloat((proj.total_budget / (16 * proj.installments_count)).toFixed(2));

                        for (let i = 1; i <= proj.installments_count; i++) {
                            const isPaid = paidInstallments.includes(i);
                            if (!isPaid) {
                                accumulatedDebt = parseFloat((accumulatedDebt + amountPerInstallment).toFixed(2));
                            }

                            history.push({
                                id: `${proj.id}-${i}`, // Composite ID for local selection
                                project_id: proj.id,
                                period_name: `${proj.name} - CUOTA ${i}`,
                                aliquot: amountPerInstallment,
                                status: isPaid ? 'PAGADO' : 'DEUDA',
                                type: 'SPECIAL',
                                installment_number: i
                            });
                        }
                    }
                }
                // --- FIN INTEGRACIÓN CUOTAS ESPECIALES ---

                // 4. Fetch All Payments for History
                const { data: paymentsHistory, error: paymentsError } = await supabase
                    .from('unit_payments')
                    .select('*')
                    .eq('unit_id', unitId)
                    .order('payment_date', { ascending: false });

                if (paymentsError) console.error('Error fetching payments history:', paymentsError);

                setFinancials({
                    latestAliquot,
                    totalBalance: accumulatedDebt,
                    latestPeriodName,
                    lastPayment: paymentsHistory && paymentsHistory.length > 0 ? paymentsHistory[0].amount_usd : 0,
                    lastPaymentDate: paymentsHistory && paymentsHistory.length > 0 ? paymentsHistory[0].payment_date : null,
                    history,
                    payments: paymentsHistory || []
                });
            }
        } catch (error) {
            console.error('Error fetching financial data:', error);
        }
    };

    const handleDeletePayment = async (paymentId) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer y el saldo de la unidad se actualizará.')) {
            return;
        }

        try {
            setLoading(true);

            // 1. Eliminar asignaciones manuales para evitar errores de FK
            await supabase
                .from('unit_payment_allocations')
                .delete()
                .eq('payment_id', paymentId);

            // 2. Eliminar vínculos con cuotas especiales (proyectos)
            await supabase
                .from('special_quota_payments')
                .delete()
                .eq('unit_payment_id', paymentId);

            // 3. Eliminar el pago principal
            const { error: deleteError } = await supabase
                .from('unit_payments')
                .delete()
                .eq('id', paymentId);

            if (deleteError) throw deleteError;

            alert('✅ Pago eliminado exitosamente.');
            await fetchUnitDetails(); // Refrescar todo
        } catch (error) {
            console.error('Error deleting payment:', error);
            alert('Error al eliminar el pago: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-20">Cargando detalles...</div>;
    if (!unit) return <div className="text-center py-20">Apartamento no encontrado.</div>;

    const owner = unit.owners;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <nav className="flex text-slate-500 text-xs mb-2 items-center gap-1">
                        <Link to="/admin" className="hover:text-primary">Inicio</Link>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <Link to="/admin/apartamentos" className="hover:text-primary">Apartamentos</Link>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">Torre {unit.tower} - {unit.number}</span>
                    </nav>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Apartamento {unit.number}</h1>
                    <p className="text-slate-500 text-sm mt-1">Torre {unit.tower}, Piso {unit.floor} • {BUILDING_CONFIG.fullName}</p>
                </div>
                <div className="flex gap-3">
                    <button className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                        <span className="material-icons text-sm mr-2">edit</span>
                        Editar Información
                    </button>
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                        <span className="material-icons text-sm mr-2">add_card</span>
                        Registrar Pago
                    </button>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar: Owner Info & Timeline */}
                <div className="col-span-1 lg:col-span-4 space-y-8">
                    {/* Current Owner Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-bold text-slate-900 dark:text-white">Propietario Actual</h2>
                                <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wider ${unit.status === 'Solvente' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>
                                    {unit.status || 'SOLVENTE'}
                                </span>
                            </div>

                            {owner ? (
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                            <span className="material-icons text-3xl">person</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{owner.full_name}</h3>
                                            <p className="text-sm text-slate-500">{owner.doc_id || 'Sin documento'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="material-icons text-primary/70 text-lg">mail</span>
                                            <span className="text-slate-600 dark:text-slate-400">{owner.email || 'No registrado'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="material-icons text-primary/70 text-lg">call</span>
                                            <span className="text-slate-600 dark:text-slate-400">{owner.phone || 'No registrado'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="material-icons text-primary/70 text-lg">event</span>
                                            <span className="text-slate-600 dark:text-slate-400 italic">Propietario Actual</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    <p>Sin propietario asignado.</p>
                                    <Link to="/admin/apartamentos" className="text-primary text-sm hover:underline mt-2 block">Asignar ahora</Link>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center group">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Deuda Inicial</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">$ {unit.initial_debt || '0.00'}</span>
                                    <button
                                        onClick={() => {
                                            setNewInitialDebt(unit.initial_debt?.toString() || '0');
                                            setShowInitialDebtModal(true);
                                        }}
                                        className="material-icons text-[14px] text-slate-300 hover:text-primary transition-colors cursor-pointer"
                                    >
                                        edit
                                    </button>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block">Saldo Total</span>
                                <span className={`text-lg font-extrabold ${financials.totalBalance > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    $ {formatCurrency(financials.totalBalance)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* History Timeline - Placeholder for now */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h2 className="font-bold text-slate-900 dark:text-white mb-6">Historial de Propietarios</h2>
                        <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                            {owner ? (
                                <div className="relative pl-8">
                                    <div className="absolute left-0 top-1.5 w-[24px] h-[24px] bg-primary rounded-full border-4 border-white dark:border-slate-900 z-10 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                    </div>
                                    <p className="text-xs font-bold text-primary uppercase tracking-wide">Actual</p>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{owner.full_name}</p>
                                    <p className="text-xs text-slate-500">Presente</p>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic pl-4">No hay historial disponible.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content: Financial Ledger - Placeholder for future implementation */}
                <div className="col-span-1 lg:col-span-8 space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Última Alícuota</p>
                            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                                $ {formatCurrency(financials.latestAliquot)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 uppercase">{financials.latestPeriodName}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Último Pago</p>
                            <p className="text-2xl font-extrabold text-green-600">
                                $ {formatCurrency(financials.lastPayment)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 uppercase">
                                {financials.lastPaymentDate ? new Date(financials.lastPaymentDate).toLocaleDateString('es-VE', { timeZone: 'UTC' }) : '--'}
                            </p>
                        </div>
                        <div className={`p-5 rounded-xl shadow-lg ${financials.totalBalance > 0 ? 'bg-red-600 shadow-red-200/50' : 'bg-primary shadow-primary/20'}`}>
                            <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1">Saldo Total</p>
                            <p className="text-2xl font-extrabold text-white">
                                $ {formatCurrency(financials.totalBalance)}
                            </p>
                            <p className="text-[10px] text-white/60 mt-2">Deuda pendiente acumulada</p>
                        </div>
                    </div>

                    {/* Financial History Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Historial de Alícuotas y Cobros</h3>
                            <span className="text-xs font-bold text-slate-500">{financials.history.length} Periodos</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800">
                                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-6 py-4">Periodo</th>
                                        <th className="px-6 py-4 text-right">Monto Total Torre</th>
                                        <th className="px-6 py-4 text-right">Cuota Unidad</th>
                                        <th className="px-6 py-4 text-center">Estado</th>
                                        <th className="px-6 py-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {financials.history.length > 0 ? (
                                        financials.history.map((record) => (
                                            <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200 uppercase">{record.period_name}</td>
                                                <td className="px-6 py-4 text-right text-slate-500">$ {formatCurrency(record.total_expenses)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <p className="font-black text-slate-900 dark:text-white">$ {formatCurrency(record.aliquot)}</p>
                                                    {record.paid_amount > 0 && record.paid_amount < record.aliquot - 0.05 && (
                                                        <p className="text-[10px] text-green-600 font-bold uppercase">Abonado: $ {formatCurrency(record.paid_amount)}</p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${record.status === 'PAGADO'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30'
                                                        }`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {record.status === 'PAGADO' ? (
                                                        <button className="text-green-600 hover:text-green-700 font-bold text-xs uppercase cursor-pointer flex items-center justify-end gap-1">
                                                            <span className="material-icons text-xs">receipt</span> Ver
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs font-medium">--</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-10 text-center text-slate-400 italic">No hay registros financieros publicados para esta torre.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Payment History Table (Actual Payments) */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Historial de Pagos Registrados</h3>
                            <span className="text-xs font-bold text-slate-500">{financials.payments?.length || 0} Pagos</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800">
                                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-6 py-4">Fecha</th>
                                        <th className="px-6 py-4">Referencia</th>
                                        <th className="px-6 py-4 text-right">Monto USD/Bs</th>
                                        <th className="px-6 py-4 text-center">Tasa</th>
                                        <th className="px-6 py-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                    {financials.payments?.length > 0 ? (
                                        financials.payments.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                                                    {new Date(p.payment_date).toLocaleDateString('es-VE', { timeZone: 'UTC' })}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 uppercase font-medium">{p.reference}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <p className="font-extrabold text-slate-900 dark:text-white">$ {formatCurrency(p.amount_usd)}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Bs {formatCurrency(p.amount_bs)}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center text-xs font-bold text-slate-500">
                                                    {p.bcv_rate ? `Bs ${formatCurrency(p.bcv_rate)}` : '--'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleDeletePayment(p.id)}
                                                        className="text-red-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                                                        title="Eliminar Pago"
                                                    >
                                                        <span className="material-icons text-sm">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-10 text-center text-slate-400 italic">No hay pagos registrados para esta unidad.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Editar Deuda Inicial */}
            {showInitialDebtModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Editar Deuda Histórica</h3>
                                <button onClick={() => setShowInitialDebtModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-icons">close</span>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 font-bold uppercase mb-6 leading-relaxed">
                                Este monto representa la deuda acumulada del apartamento antes de registrar periodos en este sistema.
                            </p>
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Monto de Deuda Inicial (USD)</span>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={newInitialDebt}
                                            onChange={(e) => setNewInitialDebt(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:border-primary"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowInitialDebtModal(false)}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleUpdateInitialDebt}
                                className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-blue-700 transition-colors"
                            >
                                GUARDAR CAMBIOS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            <QuotaPaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                pendingPeriods={financials.history.filter(p => p.status === 'DEUDA').map(p => ({
                    ...p,
                    amount: p.aliquot // Modal expects 'amount'
                }))}
                unit={unit}
                onSubmit={() => {
                    fetchUnitDetails(); // Refresh data
                    alert('Pago registrado correctamente');
                }}
            />
        </div>
    );
};

export default UnitDetail;
