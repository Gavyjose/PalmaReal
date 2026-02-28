import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { supabase } from '../supabase';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { formatCurrency } from '../utils/formatters';
import { buildFinancialLedger } from '../utils/financialUtils';
import QuotaPaymentModal from '../components/QuotaPaymentModal';

const fetchUnitDetails = async (unitId) => {
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
        .eq('id', unitId)
        .single();

    if (error) throw error;
    return data;
};

const fetchFinancialData = async ([, tower, unitId, initialDebtValue]) => {
    if (!tower) return null;
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

    // 3. Fetch special projects
    const { data: specialProjects } = await supabase
        .from('special_quota_projects')
        .select('*')
        .eq('tower_id', normalizedTower)
        .eq('status', 'ACTIVE');

    let allSpecialPayments = [];
    if (specialProjects && specialProjects.length > 0) {
        for (const proj of specialProjects) {
            const { data: sPayments } = await supabase
                .from('special_quota_payments')
                .select('*')
                .eq('project_id', proj.id)
                .eq('unit_id', unitId);
            if (sPayments) {
                allSpecialPayments.push(...sPayments);
            }
        }
    }

    // 4. Fetch All Payments for History
    const { data: paymentsHistory, error: paymentsError } = await supabase
        .from('unit_payments')
        .select('*')
        .eq('unit_id', unitId)
        .order('payment_date', { ascending: false });

    if (paymentsError) console.error('Error fetching payments history:', paymentsError);

    return buildFinancialLedger({
        initialDebtValue,
        condoPeriods: periods,
        specialProjects,
        specialPayments: allSpecialPayments,
        paymentsMap,
        paymentsHistory: paymentsHistory || []
    });
};

const UnitDetail = () => {
    const { id } = useParams(); // This captures the unit ID (UUID)
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showInitialDebtModal, setShowInitialDebtModal] = useState(false);
    const [newInitialDebt, setNewInitialDebt] = useState('0');
    const [isMutating, setIsMutating] = useState(false);

    // SWR Data Fetching
    const { data: unit, error: unitError, isLoading: isUnitLoading, mutate: mutateUnit } = useSWR(id ? id : null, fetchUnitDetails);

    // Dependent Fetching (only runs when unit is available)
    const { data: financialsData, error: finError, mutate: mutateFinancials } = useSWR(
        unit ? ['financials', unit.tower, unit.id, unit.initial_debt] : null,
        fetchFinancialData
    );

    const loading = isUnitLoading || isMutating;
    const error = unitError || finError;

    const financials = financialsData || {
        latestAliquot: 0,
        totalBalance: 0,
        latestPeriodName: '--',
        lastPayment: 0,
        history: [],
        payments: []
    };

    const handleUpdateInitialDebt = async () => {
        try {
            setIsMutating(true);
            const amount = parseFloat(newInitialDebt) || 0;
            const { error } = await supabase
                .from('units')
                .update({ initial_debt: amount })
                .eq('id', id);

            if (error) throw error;

            setShowInitialDebtModal(false);
            await mutateUnit(); // Refresh data via SWR
            alert('✅ Deuda inicial actualizada exitosamente.');
        } catch (error) {
            console.error('Error updating initial debt:', error);
            alert('Error al actualizar: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const handleDeletePayment = async (paymentId) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer y el saldo de la unidad se actualizará.')) {
            return;
        }

        try {
            setIsMutating(true);

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
            await Promise.all([mutateUnit(), mutateFinancials()]);
        } catch (error) {
            console.error('Error deleting payment:', error);
            alert('Error al eliminar el pago: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    if (loading && !unit) return <div className="text-center py-20">Cargando detalles...</div>;
    if (error) return <div className="text-center py-20 text-red-500">Error al cargar datos de la unidad.</div>;
    if (!unit) return <div className="text-center py-20">Apartamento no encontrado.</div>;

    const owner = unit.owners;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <nav className="flex text-slate-500 text-[10px] font-mono font-bold uppercase tracking-widest mb-3 items-center gap-2">
                        <Link to="/admin" className="hover:text-slate-900 dark:hover:text-white transition-colors">Inicio</Link>
                        <span>/</span>
                        <Link to="/admin/apartamentos" className="hover:text-slate-900 dark:hover:text-white transition-colors">Directorio</Link>
                        <span>/</span>
                        <span className="text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white">U- {unit.number}</span>
                    </nav>
                    <h1 className="text-4xl font-mono font-black text-slate-900 dark:text-white uppercase tracking-tighter">UNIDAD {unit.number}</h1>
                    <p className="text-slate-500 text-xs font-mono font-bold uppercase tracking-widest mt-1">Torre {unit.tower}, Piso {unit.floor} • {BUILDING_CONFIG.fullName}</p>
                </div>
                <div className="flex gap-0 border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <button className="inline-flex items-center px-4 py-3 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-r border-slate-300 dark:border-slate-700">
                        <span className="material-icons text-sm mr-2">edit</span>
                        MODIFICAR REGISTRO
                    </button>
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="inline-flex items-center px-4 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-mono font-black uppercase tracking-widest hover:invert transition-colors cursor-pointer"
                    >
                        <span className="material-icons text-sm mr-2">add_record</span>
                        INSTRUMENTAR PAGO
                    </button>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar: Owner Info & Timeline */}
                <div className="col-span-1 lg:col-span-4 space-y-6">
                    {/* Current Owner Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-none border border-slate-300 dark:border-slate-700 shadow-none overflow-hidden relative">
                        {/* Status Bar */}
                        <div className={`absolute top-0 left-0 w-2 h-full ${unit.status === 'Solvente' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                        <div className="p-6 pl-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-mono font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white">Titular Registrado</h2>
                                <span className={`px-2 py-1 text-[9px] font-mono font-black uppercase tracking-widest border ${unit.status === 'Solvente' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-800'}`}>
                                    {unit.status || 'SOLVENTE'}
                                </span>
                            </div>

                            {owner ? (
                                <>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                                            <span className="material-icons text-2xl">account_box</span>
                                        </div>
                                        <div>
                                            <h3 className="font-mono font-black text-lg text-slate-900 dark:text-white uppercase leading-tight">{owner.full_name}</h3>
                                            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">DOC: {owner.doc_id || 'N/D'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 font-mono text-[11px] uppercase tracking-wider">
                                        <div className="flex items-start gap-3">
                                            <span className="material-icons text-slate-400 text-sm mt-0.5">mail</span>
                                            <span className="text-slate-700 dark:text-slate-300 break-words font-bold">{owner.email || 'NO REGISTRADO'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="material-icons text-slate-400 text-sm">call</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-bold">{owner.phone || 'NO REGISTRADO'}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-6 text-slate-500 font-mono text-xs uppercase tracking-widest border border-dashed border-slate-300 dark:border-slate-700 mt-4 p-4">
                                    <p>Sin asiganción de titular.</p>
                                    <Link to="/admin/apartamentos" className="text-slate-900 font-black dark:text-white underline mt-2 block hover:bg-slate-100 dark:hover:bg-slate-800 p-2">Vincular Registro</Link>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center group">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">Arrastre Histórico</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono font-black text-slate-900 dark:text-white tabular-nums">$ {formatCurrency(financials.remainingInitialDebt || 0)}</span>
                                    <button
                                        onClick={() => {
                                            setNewInitialDebt(unit.initial_debt?.toString() || '0');
                                            setShowInitialDebtModal(true);
                                        }}
                                        className="material-icons text-sm text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                                        title="Rectificar Arrastre"
                                    >
                                        edit
                                    </button>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1 block">Pasivo Total</span>
                                <span className={`text-xl font-mono font-black tabular-nums ${financials.totalBalance > 0 ? 'text-red-600 dark:text-red-500' : 'text-slate-900 dark:text-white'}`}>
                                    $ {formatCurrency(financials.totalBalance)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* History Timeline */}
                    <div className="bg-white dark:bg-slate-900 rounded-none border border-slate-300 dark:border-slate-700 shadow-none p-6">
                        <h2 className="font-mono font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white mb-6">Trazabilidad de Dominio</h2>
                        <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                            {owner ? (
                                <div className="relative pl-8">
                                    <div className="absolute left-0 top-1.5 w-6 h-6 bg-slate-900 dark:bg-white rounded-none border-2 border-white dark:border-slate-900 z-10 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white dark:bg-slate-900"></div>
                                    </div>
                                    <p className="text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest mb-1">PROPIETARIO VIGENTE</p>
                                    <p className="font-mono font-bold text-slate-900 dark:text-white text-xs uppercase">{owner.full_name}</p>
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest pl-4">No hay registros auditables.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content: Financial Ledger */}
                <div className="col-span-1 lg:col-span-8 space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900">
                        <div className="p-6 border-b md:border-b-0 md:border-r border-slate-300 dark:border-slate-800">
                            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">Última Emisión</p>
                            <p className="text-3xl font-mono font-black text-slate-900 dark:text-white tabular-nums">
                                $ {formatCurrency(financials.latestAliquot)}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-2 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 p-1 px-2 inline-block">{financials.latestPeriodName}</p>
                        </div>
                        <div className="p-6 border-b md:border-b-0 md:border-r border-slate-300 dark:border-slate-800">
                            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">Último Ingreso</p>
                            <p className="text-3xl font-mono font-black text-emerald-600 tabular-nums">
                                $ {formatCurrency(financials.lastPayment)}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 font-bold mt-2 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 p-1 px-2 inline-block">
                                {financials.lastPaymentDate ? new Date(financials.lastPaymentDate).toLocaleDateString('es-VE', { timeZone: 'UTC' }) : 'SIN REGISTRO'}
                            </p>
                        </div>
                        <div className={`p-6 bg-slate-900 text-white dark:bg-slate-800 relative overflow-hidden group transition-all`}>
                            {financials.totalBalance > 0 && (
                                <div className="absolute top-0 right-0 w-16 h-16 bg-red-600 transform translate-x-8 -translate-y-8 rotate-45"></div>
                            )}
                            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Pasivo Acumulado</p>
                            <p className={`text-3xl font-mono font-black tabular-nums relative z-10 ${financials.totalBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                $ {formatCurrency(financials.totalBalance)}
                            </p>
                            <p className="text-[10px] font-mono font-bold text-slate-500 mt-2 uppercase tracking-widest relative z-10">
                                {financials.totalBalance > 0 ? 'DÉFICIT DETECTADO' : 'SOLVENCIA VERIFICADA'}
                            </p>
                        </div>
                    </div>

                    {/* Financial History Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-none border border-slate-300 dark:border-slate-700 shadow-none overflow-hidden">
                        <div className="p-4 border-b-2 border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                            <h3 className="font-mono font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs">Afectaciones Financieras</h3>
                            <span className="text-[10px] font-mono font-bold text-slate-500 tracking-widest uppercase bg-white dark:bg-slate-900 px-2 py-1 border border-slate-300 dark:border-slate-700">{financials.history.length} CARGOS</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-800/50">
                                    <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-mono font-bold border-b border-slate-300 dark:border-slate-700">
                                        <th className="px-6 py-4">Concepto Operativo</th>
                                        <th className="px-6 py-4 text-right">Monto Global</th>
                                        <th className="px-6 py-4 text-right">Porción Asignada</th>
                                        <th className="px-6 py-4 text-center">Estatus</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-mono">
                                    {financials.history.length > 0 ? (
                                        financials.history.map((record) => (
                                            <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{record.period_name}</p>
                                                    <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${record.type === 'SPECIAL' ? 'text-amber-600' : record.type === 'HISTORY' ? 'text-red-600' : 'text-slate-500'}`}>
                                                        {record.type === 'SPECIAL' ? 'CUOTA ESPECIAL' : record.type === 'HISTORY' ? 'ARRASTRE HISTÓRICO' : 'MANTENIMIENTO'}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-500 tabular-nums">$ {formatCurrency(record.total_expenses)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    {(() => {
                                                        const fullQuota = record.original_aliquot || record.aliquot;
                                                        const totalAbonado = (record.paid_amount || 0) + (record.credit_applied || 0);
                                                        const pendingDebt = Math.max(0, fullQuota - totalAbonado);
                                                        const isPaidRow = record.status === 'PAGADO';
                                                        const isCreditRow = record.type === 'HISTORY_CREDIT';

                                                        return (
                                                            <>
                                                                <p className={`font-black tabular-nums ${isCreditRow ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                                                                    {isCreditRow ? '-' : ''}$ {formatCurrency(fullQuota)}
                                                                </p>
                                                                {totalAbonado > 0 && !isPaidRow && !isCreditRow && (
                                                                    <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1 tracking-widest">
                                                                        Abonado: $ {formatCurrency(totalAbonado)}
                                                                    </p>
                                                                )}
                                                                {pendingDebt > 0 && !isPaidRow && !isCreditRow && (
                                                                    <p className="text-[9px] text-red-600 dark:text-red-400 font-bold uppercase mt-1 tracking-widest leading-tight">
                                                                        Saldo Deudor: $ {formatCurrency(pendingDebt)}
                                                                    </p>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 border whitespace-nowrap text-[9px] font-black uppercase tracking-widest ${record.status === 'PAGADO'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50'
                                                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-800/50'
                                                        }`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No existen cargos contables registrados.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Payment History Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-none border border-slate-300 dark:border-slate-700 shadow-none overflow-hidden">
                        <div className="p-4 border-b-2 border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                            <h3 className="font-mono font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs">Movimientos Transaccionales</h3>
                            <span className="text-[10px] font-mono font-bold text-slate-500 tracking-widest uppercase bg-white dark:bg-slate-900 px-2 py-1 border border-slate-300 dark:border-slate-700">{financials.payments?.length || 0} ABONOS</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-800/50">
                                    <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-mono font-bold border-b border-slate-300 dark:border-slate-700">
                                        <th className="px-6 py-4">F. Valor</th>
                                        <th className="px-6 py-4">Traza Auditoría</th>
                                        <th className="px-6 py-4 text-right">Inyección USD/Bs</th>
                                        <th className="px-6 py-4 text-center">Tasa Aplicada</th>
                                        <th className="px-6 py-4 text-right">Auditar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-mono">
                                    {financials.payments?.length > 0 ? (
                                        financials.payments.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                                                    {new Date(p.payment_date).toLocaleDateString('es-VE', { timeZone: 'UTC' })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] text-slate-800 dark:text-slate-200 uppercase font-black tracking-widest border border-slate-300 dark:border-slate-700">{p.reference}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <p className="font-black text-slate-900 dark:text-white tabular-nums">$ {formatCurrency(p.amount_usd)}</p>
                                                    {p.amount_bs > 0 && <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 tabular-nums">Bs {formatCurrency(p.amount_bs)}</p>}
                                                </td>
                                                <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 tracking-widest tabular-nums">
                                                    {p.bcv_rate ? `Bs ${formatCurrency(p.bcv_rate)}` : '--'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleDeletePayment(p.id)}
                                                        className="text-red-600 hover:text-white border border-transparent hover:bg-red-600 transition-colors p-1 flex items-center justify-center float-right"
                                                        title="Revocar Asiento"
                                                    >
                                                        <span className="material-icons text-sm block">delete_outline</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Ausencia de movimientos financieros.</td>
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-none border-2 border-slate-900 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-6 border-b-2 border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Rectificar Arrastre</h3>
                                <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-1">AJUSTE HISTÓRICO MAESTRO</p>
                            </div>
                            <button onClick={() => setShowInitialDebtModal(false)} className="w-8 h-8 flex items-center justify-center border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-900 hover:text-white transition-colors">
                                <span className="material-icons text-sm">close</span>
                            </button>
                        </div>
                        <div className="p-8">
                            <p className="text-[10px] font-mono text-slate-500 font-bold uppercase mb-6 leading-relaxed bg-slate-50 dark:bg-slate-800/30 p-4 border border-slate-200 dark:border-slate-800">
                                Importe correspondiente a la deuda consolidada de la unidad previo a la informatización del sistema.
                            </p>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">Base Imponible (USD)</label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-900 dark:text-white font-mono font-black text-lg">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newInitialDebt}
                                        onChange={(e) => setNewInitialDebt(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none pl-12 pr-6 py-4 font-mono font-black text-2xl text-slate-900 dark:text-white outline-none focus:border-slate-900 dark:focus:border-white transition-colors tabular-nums"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-800 flex gap-4">
                            <button
                                onClick={() => setShowInitialDebtModal(false)}
                                className="flex-1 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-[10px] text-slate-500 uppercase tracking-widest hover:border-slate-900 dark:hover:border-white hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                ABORTAR
                            </button>
                            <button
                                onClick={handleUpdateInitialDebt}
                                className="flex-1 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-2 border-transparent font-mono font-black text-xs uppercase tracking-widest hover:invert transition-all"
                            >
                                EJECUTAR
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
                onSubmit={async () => {
                    await Promise.all([mutateUnit(), mutateFinancials()]);
                    alert('Pago registrado correctamente');
                }}
            />
        </div>
    );
};

export default UnitDetail;
