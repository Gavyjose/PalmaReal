import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOwnerData } from '../hooks/useOwnerData';
import { supabase } from '../supabase';
import { formatNumber } from '../utils/formatters';
import { usePaymentOcr } from '../hooks/usePaymentOcr';

// Premium Sub-components
import OwnerOverviewCard from '../components/owner/OwnerOverviewCard';
import OwnerAnnouncements from '../components/owner/OwnerAnnouncements';
import PaymentHistoryTable from '../components/owner/PaymentHistoryTable';
import SpecialProjectsFeed from '../components/owner/SpecialProjectsFeed';
import DebtEvolutionChart from '../components/owner/DebtEvolutionChart';
import OwnerPaymentModal from '../components/owner/OwnerPaymentModal';

const OwnerPortal = () => {
    const { profile, unit, announcements, payments, projects, debt, settings, notifyPayment, pendingPeriods, loading } = useOwnerData();
    const [filter, setFilter] = useState('ALL');
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', msg: string }
    const [todayRate, setTodayRate] = useState(0);

    // Nuevos estados para el formato de cobranzas
    const [selectedPeriods, setSelectedPeriods] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
    const [amountBs, setAmountBs] = useState('');
    const [cashAmountUsd, setCashAmountUsd] = useState('');
    const [bcvRate, setBcvRate] = useState(0);
    const [isEditingRate, setIsEditingRate] = useState(false);
    const [reference, setReference] = useState('');
    const [opDate, setOpDate] = useState(new Date().toISOString().split('T')[0]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // Estado para modal de detalle de proyecto especial
    const [projectDetail, setProjectDetail] = useState(null);
    const [projectDetailLoading, setProjectDetailLoading] = useState(false);

    // Initial fetch for today's rate (for the header)
    useEffect(() => {
        const fetchTodayRate = async () => {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase.rpc('get_bcv_rate', { p_date: today });
            if (!error && data) {
                setTodayRate(parseFloat(data));
            }
        };
        fetchTodayRate();
    }, []);

    // Sync bcvRate with opDate whenever the date changes
    useEffect(() => {
        const fetchRateAtDate = async () => {
            if (!opDate) return;
            const { data, error } = await supabase.rpc('get_bcv_rate', { p_date: opDate });
            if (!error && data) {
                // We only auto-update if the user is NOT in manual override mode
                if (!isEditingRate) {
                    setBcvRate(parseFloat(data));
                }
            }
        };
        fetchRateAtDate();
    }, [opDate, isEditingRate]);

    const {
        file,
        previewUrl,
        ocrProcessing,
        ocrValidation,
        handleFileChange,
        resetOcr
    } = usePaymentOcr(reference); 

    // Helper para formatear currency igual que en cobranzas
    const formatCurrency = (val) => formatNumber(val);

    const totalSelectedUsd = selectedPeriods.reduce((sum, p) => {
        const totalAbonado = (p.paid_amount || 0);
        const pendingDebt = Math.max(0, p.amount - totalAbonado);
        return sum + pendingDebt;
    }, 0);
    
    // Auto-llenado de montos al seleccionar periodos
    useEffect(() => {
        if (selectedPeriods.length > 0) {
            if (paymentMethod === 'TRANSFER') {
                if (bcvRate > 0) {
                    const totalBs = parseFloat((totalSelectedUsd * bcvRate).toFixed(2));
                    setAmountBs(totalBs.toString());
                }
            } else {
                setCashAmountUsd(totalSelectedUsd.toFixed(2));
            }
        } else {
            setAmountBs('');
            setCashAmountUsd('');
        }
    }, [selectedPeriods, paymentMethod, bcvRate, totalSelectedUsd]);


    const amountUsd = paymentMethod === 'TRANSFER'
        ? (bcvRate > 0 && amountBs > 0 ? parseFloat((parseFloat(amountBs) / bcvRate).toFixed(2)) : 0)
        : (parseFloat(cashAmountUsd) || 0);

    const togglePeriod = (period) => {
        if (selectedPeriods.find(p => p.id === period.id)) {
            setSelectedPeriods(selectedPeriods.filter(p => p.id !== period.id));
        } else {
            setSelectedPeriods([...selectedPeriods, period]);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-display-medium animate-pulse">Sincronizando portal...</p>
                </div>
            </div>
        );
    }


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (amountUsd <= 0 || !reference || !file) {
            setStatus({ type: 'error', msg: 'Por favor completa todos los campos, incluyendo el comprobante.' });
            return;
        }

        if (selectedPeriods.length === 0) {
            setStatus({ type: 'error', msg: 'Por favor selecciona al menos una cuota por pagar.' });
            return;
        }

        // Validación final de OCR
        if (ocrValidation && !ocrValidation.match) {
            const confirmed = window.confirm('Los últimos 6 dígitos de la referencia no coinciden con la captura. ¿Deseas continuar de todos modos?');
            if (!confirmed) return;
        }

        setSubmitting(true);
        setStatus(null);

        const res = await notifyPayment({ 
            amount: amountUsd,
            amount_bs: paymentMethod === 'TRANSFER' ? amountBs : null,
            bcv_rate: paymentMethod === 'TRANSFER' ? bcvRate : null,
            reference: reference, 
            category: selectedPeriods[0].type === 'SPECIAL' ? 'SPECIAL' : 'ORDINARY',
            projectId: selectedPeriods[0].project_id,
            paymentMethod,
            file,
            opDate,
            selectedPeriods
        });

        setSubmitting(false);
        if (res.success) {
            setStatus({ type: 'success', msg: '¡Pago notificado con éxito! En revisión.' });
            setAmountBs('');
            setCashAmountUsd('');
            setReference('');
            setSelectedPeriods([]);
            resetOcr();
            setTimeout(() => setStatus(null), 5000);
        } else {
            setStatus({ type: 'error', msg: 'Error al notificar. Intenta de nuevo.' });
        }
    };

    const allPayments = [...payments.ordinary, ...payments.special].sort(
        (a, b) => new Date(b.payment_date) - new Date(a.payment_date)
    );

    const filteredPayments = allPayments.filter(p => {
        if (filter === 'ALL') return true;
        if (filter === 'ORDINARY') return !p.project_id;
        if (filter === 'SPECIAL') return !!p.project_id;
        return true;
    });

    return (
        <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20 px-4 md:px-8">
            <header className="py-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-white/5 mb-12">
                <div>
                    <div className="flex items-center gap-2 text-micro text-emerald-600 dark:text-emerald-400 mb-2">
                        <span>Residencias Palma Real</span>
                        <span className="opacity-30">/</span>
                        <span className="text-slate-900 dark:text-white">Panel maestro</span>
                    </div>
                    <h1 className="text-5xl font-display-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
                        Control <span className="text-emerald-500">Propietario</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-display-medium mt-2 flex items-center gap-2">
                        <span className="material-icons text-xs">location_on</span>
                        Torre {unit?.tower} <span className="opacity-30">·</span> Apartamento {unit?.number}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-6 py-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl shadow-xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                             <span className="material-icons">query_stats</span>
                        </div>
                        <div>
                             <span className="text-micro text-slate-400 block">Tasa BCV</span>
                             <span className="text-sm font-display-black text-slate-900 dark:text-white">
                                Bs. {todayRate > 0 ? formatNumber(todayRate) : '---'}
                             </span>
                        </div>
                    </div>
                </div>
            </header>

            {!unit && (
                <div className="mb-12 p-8 bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] flex items-center gap-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="w-16 h-16 bg-amber-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-amber-500/20">
                        <span className="material-icons text-3xl">terminal</span>
                    </div>
                    <div>
                        <h4 className="text-sm font-display-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Modo Simulación Activo</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-display-medium mt-1 leading-relaxed">
                            No se detectó un apartamento vinculado a este perfil. Está visualizando datos de **demostración técnica** generados por el centro de mando.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-12 gap-8 lg:gap-12">
                {/* Dashboard Principal */}
                <div className="col-span-12 xl:col-span-8 space-y-12">
                    
                    <OwnerOverviewCard 
                        debt={debt} 
                        unit={unit} 
                        onOpenPaymentModal={() => setIsPaymentModalOpen(true)} 
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <DebtEvolutionChart debt={debt} />
                        <OwnerAnnouncements announcements={announcements} />
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-sm font-display-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                             <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                             Iniciativas de Capital
                        </h3>
                        <SpecialProjectsFeed projects={projects} />
                    </div>

                    <PaymentHistoryTable 
                        payments={filteredPayments} 
                        filter={filter} 
                        onFilterChange={setFilter} 
                    />
                </div>

                {/* Right Column: Bank Info only */}
                <div className="col-span-12 xl:col-span-4 space-y-8">
                    {/* Bank Info Section (Consolidated) */}
                    <div className="group">
                        <div className="bg-gradient-to-br from-white/40 to-white/10 dark:from-slate-800/40 dark:to-slate-900/10 backdrop-blur-3xl border border-white/20 dark:border-white/5 rounded-[3rem] p-10 shadow-2xl transition-all hover:shadow-emerald-500/5">
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                                        <span className="material-icons text-2xl">account_balance_wallet</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-display-black text-slate-900 dark:text-white uppercase tracking-tight">Cuentas Receptoras</h3>
                                        <p className="text-[10px] text-slate-400 font-display-bold uppercase tracking-widest">Tesorería Palma Real</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-display-black text-slate-400 uppercase tracking-widest">Entidad Bancaria</p>
                                        <p className="text-sm font-display-bold text-slate-800 dark:text-white uppercase tracking-tight">{settings?.bank_name || '---'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-display-black text-slate-400 uppercase tracking-widest">Titular de Cuenta</p>
                                        <p className="text-sm font-display-bold text-slate-800 dark:text-white uppercase tracking-tight">{settings?.account_holder || '---'}</p>
                                    </div>
                                </div>
                                <div className="space-y-4 border-t border-slate-100 dark:border-white/5 pt-6">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-display-black text-emerald-500 uppercase tracking-widest">Dato de Identificación (PM)</p>
                                        <p className="text-sm font-display-bold text-slate-800 dark:text-white font-mono tracking-tighter">{settings?.pm_id || '---'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-display-black text-emerald-500 uppercase tracking-widest">Número Telefónico (PM)</p>
                                        <p className="text-sm font-display-bold text-slate-800 dark:text-white font-mono tracking-tighter">{settings?.pm_phone || '---'}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-slate-50/50 dark:bg-slate-950/20 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 mt-auto">
                                    <p className="text-[9px] font-display-black text-slate-400 uppercase tracking-widest mb-2">Número de Cuenta Nacional</p>
                                    <p className="text-sm font-display-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-[0.2em]">{settings?.account_number || '---'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <OwnerPaymentModal 
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                unit={unit}
                pendingPeriods={pendingPeriods}
                selectedPeriods={selectedPeriods}
                onTogglePeriod={togglePeriod}
                totalSelectedUsd={totalSelectedUsd}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                opDate={opDate}
                onOpDateChange={setOpDate}
                amountBs={amountBs}
                onAmountBsChange={setAmountBs}
                cashAmountUsd={cashAmountUsd}
                onCashAmountUsdChange={setCashAmountUsd}
                bcvRate={bcvRate}
                onBcvRateChange={setBcvRate}
                isEditingRate={isEditingRate}
                onIsEditingRateChange={setIsEditingRate}
                reference={reference}
                onReferenceChange={setReference}
                status={status}
                submitting={submitting}
                onSubmit={handleSubmit}
                previewUrl={previewUrl}
                ocrProcessing={ocrProcessing}
                ocrValidation={ocrValidation}
                onFileChange={handleFileChange}
            />

            {/* Modal Detalle Proyecto Especial */}
            {projectDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setProjectDetail(null)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
                    <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-white/20 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-display-black text-slate-900 dark:text-white uppercase tracking-tight">{projectDetail.name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-[9px] font-display-black px-2 py-0.5 rounded-full tracking-widest ${projectDetail.status === 'CLOSED' ? 'bg-slate-200 dark:bg-slate-700 text-slate-500' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'}`}>
                                        {projectDetail.status === 'CLOSED' ? 'CERRADO' : 'ACTIVO'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">Presupuesto: ${formatNumber(projectDetail.total_budget)}</span>
                                </div>
                            </div>
                            <button onClick={() => setProjectDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <span className="material-icons text-sm text-slate-500">close</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto max-h-[calc(85vh-120px)] p-6 space-y-6">
                            {projectDetailLoading ? (
                                <div className="text-center py-8 text-slate-400">Cargando detalle...</div>
                            ) : (
                                <>
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                                            <p className="text-[9px] font-display-black uppercase tracking-widest text-emerald-600 mb-1">Recaudado</p>
                                            <p className="text-xl font-black text-emerald-600 tabular-nums">${formatNumber(projectDetail.totalCollected || 0)}</p>
                                        </div>
                                        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 text-center">
                                            <p className="text-[9px] font-display-black uppercase tracking-widest text-rose-500 mb-1">Gastado</p>
                                            <p className="text-xl font-black text-rose-500 tabular-nums">${formatNumber(projectDetail.totalExpenses || 0)}</p>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-center">
                                            <p className="text-[9px] font-display-black uppercase tracking-widest text-blue-600 mb-1">Disponible</p>
                                            <p className="text-xl font-black text-blue-600 tabular-nums">${formatNumber((projectDetail.totalCollected || 0) - (projectDetail.totalExpenses || 0))}</p>
                                        </div>
                                    </div>

                                    {/* Gastos */}
                                    <div>
                                        <h4 className="text-[10px] font-display-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                                            Detalle de Gastos
                                        </h4>
                                        {projectDetail.expenses?.length > 0 ? (
                                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                                        <tr>
                                                            <th className="px-4 py-2.5 text-left text-[9px] font-display-black uppercase tracking-widest text-slate-400">Fecha</th>
                                                            <th className="px-4 py-2.5 text-left text-[9px] font-display-black uppercase tracking-widest text-slate-400">Descripción</th>
                                                            <th className="px-4 py-2.5 text-left text-[9px] font-display-black uppercase tracking-widest text-slate-400">Categoría</th>
                                                            <th className="px-4 py-2.5 text-right text-[9px] font-display-black uppercase tracking-widest text-slate-400">Monto USD</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {projectDetail.expenses.map((exp, i) => (
                                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{new Date(exp.date).toLocaleDateString('es-VE')}</td>
                                                                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 font-display-medium">{exp.description}</td>
                                                                <td className="px-4 py-2.5"><span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-display-bold uppercase">{exp.category}</span></td>
                                                                <td className="px-4 py-2.5 text-right font-display-bold text-rose-500 tabular-nums">${formatNumber(exp.amount_usd)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-center text-slate-400 text-xs py-4 italic">Sin gastos registrados</p>
                                        )}
                                    </div>

                                    {/* Recaudación */}
                                    <div>
                                        <h4 className="text-[10px] font-display-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                            Recaudación ({projectDetail.payments?.length || 0} pagos)
                                        </h4>
                                        {projectDetail.payments?.length > 0 ? (
                                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                                        <tr>
                                                            <th className="px-4 py-2.5 text-left text-[9px] font-display-black uppercase tracking-widest text-slate-400">Fecha</th>
                                                            <th className="px-4 py-2.5 text-left text-[9px] font-display-black uppercase tracking-widest text-slate-400">Referencia</th>
                                                            <th className="px-4 py-2.5 text-center text-[9px] font-display-black uppercase tracking-widest text-slate-400">Cuota #</th>
                                                            <th className="px-4 py-2.5 text-right text-[9px] font-display-black uppercase tracking-widest text-slate-400">Monto USD</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {projectDetail.payments.map((pay, i) => (
                                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{new Date(pay.payment_date).toLocaleDateString('es-VE')}</td>
                                                                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 font-display-bold uppercase">{pay.reference}</td>
                                                                <td className="px-4 py-2.5 text-center text-slate-500">#{pay.installment_number}</td>
                                                                <td className="px-4 py-2.5 text-right font-display-bold text-emerald-600 tabular-nums">${formatNumber(pay.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-center text-slate-400 text-xs py-4 italic">Sin pagos registrados</p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OwnerPortal;
