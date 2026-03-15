import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';
import { useAuth } from '../context/AuthContext';

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MONTHS_UPPER = MONTHS.map(m => m.toUpperCase());

const formatBs = (n) => {
    if (n === null || n === undefined || isNaN(n)) return 'Bs 0,00';
    return 'Bs ' + Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const COMMISSION_KEYWORDS = ['COMISION', 'COMIS.', 'MANTENIMIENTO DE CUENTA', 'USO DEL CANAL', 'SMS', 'ITF', 'GASTOS ADMINISTRATIVOS', 'CARGO POR MANTENIMIENTO', 'BANCAREA', 'BANCARIA'];

const CashBook = () => {
    const { activeTowers } = useTowers();
    const { userRole } = useAuth();
    const now = new Date();
    const [selectedTower, setSelectedTower] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [showInitialModal, setShowInitialModal] = useState(false);
    const [initialBalanceForm, setInitialBalanceForm] = useState({ amount: '', date: '' });
    const [manualForm, setManualForm] = useState({ concept: '', tipo: 'MANUAL_ENTRADA', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [prevMonthBalance, setPrevMonthBalance] = useState(null); // saldo final del mes anterior disponible para arrastrar
    const [carryingForward, setCarryingForward] = useState(false);

    const years = Array.from({ length: 3 }, (_, i) => String(now.getFullYear() - i));

    // Set initial tower once loaded
    useEffect(() => {
        if (activeTowers.length > 0 && !selectedTower) {
            setSelectedTower(activeTowers[0].name);
        }
    }, [activeTowers]);

    useEffect(() => {
        if (selectedTower && selectedMonth && selectedYear) {
            fetchEntries();
        }
    }, [selectedTower, selectedMonth, selectedYear]);

    // Helper: get previous month+year as { month: '01'...'12', year: 'YYYY' }
    const getPrevPeriod = () => {
        const m = parseInt(selectedMonth);
        const y = parseInt(selectedYear);
        if (m === 1) return { month: '12', year: String(y - 1) };
        return { month: String(m - 1).padStart(2, '0'), year: String(y) };
    };

    // Fetch closing balance of previous month
    const fetchPrevMonthBalance = async (currentEntries) => {
        const hasInit = currentEntries.some(e => e.tipo === 'SALDO_INICIAL');
        if (hasInit) { setPrevMonthBalance(null); return; }

        const { month: pm, year: py } = getPrevPeriod();
        const prevPeriodName = `${MONTHS_UPPER[parseInt(pm) - 1]} ${py}`;
        const prevStartDate = `${py}-${pm}-01`;
        const prevEndDate = new Date(parseInt(py), parseInt(pm), 0).toISOString().split('T')[0];

        // Get prev period id
        const { data: prevPeriod } = await supabase
            .from('condo_periods')
            .select('id')
            .eq('tower_id', selectedTower)
            .eq('period_name', prevPeriodName)
            .maybeSingle();

        let q = supabase
            .from('cash_book_entries')
            .select('*')
            .eq('tower_id', selectedTower)
            .order('entry_date', { ascending: true })
            .order('created_at', { ascending: true });

        if (prevPeriod) {
            q = q.eq('period_id', prevPeriod.id);
        } else {
            q = q.gte('entry_date', prevStartDate).lte('entry_date', prevEndDate);
        }

        const { data: prevEntries } = await q;
        if (!prevEntries || prevEntries.length === 0) { setPrevMonthBalance(null); return; }

        // Compute running balance of prev month
        let bal = 0;
        for (const e of prevEntries) {
            if (e.tipo === 'SALDO_INICIAL') bal = e.amount_bs;
            else if (e.tipo === 'ENTRADA' || e.tipo === 'MANUAL_ENTRADA') bal += e.amount_bs;
            else bal -= e.amount_bs;
        }
        setPrevMonthBalance({ amount: bal, monthLabel: `${MONTHS[parseInt(pm) - 1]} ${py}` });
    };

    // One-click carry forward: create SALDO_INICIAL from prev month's closing balance
    const handleCarryForward = async () => {
        if (!prevMonthBalance) return;
        setCarryingForward(true);
        try {
            const periodName = `${MONTHS_UPPER[parseInt(selectedMonth) - 1]} ${selectedYear}`;
            const { data: periodData } = await supabase
                .from('condo_periods').select('id')
                .eq('tower_id', selectedTower).eq('period_name', periodName).maybeSingle();

            const { error } = await supabase.from('cash_book_entries').insert({
                tower_id: selectedTower,
                period_id: periodData?.id || null,
                entry_date: `${selectedYear}-${selectedMonth}-01`,
                concept: `Saldo Inicial (Arrastre de ${prevMonthBalance.monthLabel})`,
                tipo: 'SALDO_INICIAL',
                amount_bs: prevMonthBalance.amount,
                source: 'saldo_inicial',
            });
            if (error) throw error;
            setPrevMonthBalance(null);
            await fetchEntries();
        } catch (e) {
            console.error('Carry forward error:', e);
        } finally {
            setCarryingForward(false);
        }
    };

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const periodName = `${MONTHS_UPPER[parseInt(selectedMonth) - 1]} ${selectedYear}`;
            // Fetch period id
            const { data: periodData } = await supabase
                .from('condo_periods')
                .select('id')
                .eq('tower_id', selectedTower)
                .eq('period_name', periodName)
                .maybeSingle();

            let q = supabase
                .from('cash_book_entries')
                .select('*')
                .eq('tower_id', selectedTower)
                .order('entry_date', { ascending: true })
                .order('created_at', { ascending: true });

            if (periodData) {
                q = q.eq('period_id', periodData.id);
            } else {
                // Filter by date range if no period yet
                const startDate = `${selectedYear}-${selectedMonth}-01`;
                const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).toISOString().split('T')[0];
                q = q.gte('entry_date', startDate).lte('entry_date', endDate);
            }

            const { data, error } = await q;
            if (error) throw error;
            setEntries(data || []);
            // After loading, check if prev month has a closing balance to carry forward
            await fetchPrevMonthBalance(data || []);
        } catch (e) {
            console.error('Error fetching cash book:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setSuccessMsg('');
        try {
            const periodName = `${MONTHS_UPPER[parseInt(selectedMonth) - 1]} ${selectedYear}`;
            const startDate = `${selectedYear}-${selectedMonth}-01`;
            const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).toISOString().split('T')[0];

            // Find period
            const { data: periodData } = await supabase
                .from('condo_periods')
                .select('id')
                .eq('tower_id', selectedTower)
                .eq('period_name', periodName)
                .maybeSingle();

            const periodId = periodData?.id || null;

            // Get existing source refs to avoid duplicates
            const { data: existing } = await supabase
                .from('cash_book_entries')
                .select('source_ref_id, source')
                .eq('tower_id', selectedTower)
                .not('source', 'eq', 'manual')
                .not('source', 'eq', 'saldo_inicial');

            const existingRefs = new Set((existing || []).map(e => `${e.source}::${e.source_ref_id}`));

            const newEntries = [];

            // 1. ENTRADAS: Cobros de propietarios (unit_payments)
            const { data: towerUnits } = await supabase
                .from('units')
                .select('id')
                .eq('tower', selectedTower);

            if (towerUnits && towerUnits.length > 0) {
                const unitIds = towerUnits.map(u => u.id);
                const { data: payments } = await supabase
                    .from('unit_payments')
                    .select('id, payment_date, amount_bs, reference')
                    .in('unit_id', unitIds)
                    .gte('payment_date', startDate)
                    .lte('payment_date', endDate);

                for (const p of (payments || [])) {
                    const key = `cobranza::${p.id}`;
                    if (!existingRefs.has(key)) {
                        newEntries.push({
                            tower_id: selectedTower,
                            period_id: periodId,
                            entry_date: p.payment_date,
                            concept: `Cobro propietario${p.reference ? ` - Ref: ${p.reference}` : ''}`,
                            tipo: 'ENTRADA',
                            amount_bs: Math.abs(p.amount_bs || 0),
                            source: 'cobranza',
                            source_ref_id: p.id,
                        });
                        existingRefs.add(key);
                    }
                }
            }

            // 2. SALIDAS: Gastos pagados del período
            if (periodId) {
                const { data: expenses } = await supabase
                    .from('period_expenses')
                    .select('id, description, amount_bs, payment_date, payment_status')
                    .eq('period_id', periodId)
                    .eq('payment_status', 'PAGADO');

                for (const exp of (expenses || [])) {
                    const key = `gasto::${exp.id}`;
                    if (!existingRefs.has(key) && exp.amount_bs > 0) {
                        newEntries.push({
                            tower_id: selectedTower,
                            period_id: periodId,
                            entry_date: exp.payment_date || startDate,
                            concept: exp.description,
                            tipo: 'SALIDA',
                            amount_bs: Math.abs(exp.amount_bs || 0),
                            source: 'gasto',
                            source_ref_id: exp.id,
                        });
                        existingRefs.add(key);
                    }
                }
            }

            // 3. SALIDAS: Comisiones bancarias
            const { data: bankTx } = await supabase
                .from('bank_transactions')
                .select('id, transaction_date, description, amount')
                .gte('transaction_date', startDate)
                .lte('transaction_date', endDate)
                .lt('amount', 0);

            for (const tx of (bankTx || [])) {
                const desc = (tx.description || '').toUpperCase();
                const isCommission = COMMISSION_KEYWORDS.some(kw => desc.includes(kw));
                if (isCommission) {
                    const key = `banco::${tx.id}`;
                    if (!existingRefs.has(key)) {
                        newEntries.push({
                            tower_id: selectedTower,
                            period_id: periodId,
                            entry_date: tx.transaction_date,
                            concept: `Comisión bancaria - ${tx.description}`,
                            tipo: 'SALIDA',
                            amount_bs: Math.abs(tx.amount || 0),
                            source: 'banco',
                            source_ref_id: tx.id,
                        });
                        existingRefs.add(key);
                    }
                }
            }

            if (newEntries.length > 0) {
                const { error } = await supabase.from('cash_book_entries').insert(newEntries);
                if (error) throw error;
                setSuccessMsg(`✅ Se sincronizaron ${newEntries.length} transacciones correctamente.`);
            } else {
                setSuccessMsg('ℹ️ Todo ya estaba sincronizado. No hay nuevas transacciones.');
            }

            await fetchEntries();
        } catch (e) {
            console.error('Sync error:', e);
            setSuccessMsg('❌ Error al sincronizar. Revisa la consola.');
        } finally {
            setSyncing(false);
            setTimeout(() => setSuccessMsg(''), 5000);
        }
    };

    const handleSaveInitialBalance = async () => {
        if (!initialBalanceForm.amount || parseFloat(initialBalanceForm.amount) < 0) return;
        setSaving(true);
        try {
            const periodName = `${MONTHS_UPPER[parseInt(selectedMonth) - 1]} ${selectedYear}`;
            const { data: periodData } = await supabase
                .from('condo_periods').select('id')
                .eq('tower_id', selectedTower).eq('period_name', periodName).maybeSingle();

            // Remove existing initial balance for this tower+period if any
            await supabase.from('cash_book_entries')
                .delete()
                .eq('tower_id', selectedTower)
                .eq('tipo', 'SALDO_INICIAL')
                .eq('period_id', periodData?.id || null);

            const { error } = await supabase.from('cash_book_entries').insert({
                tower_id: selectedTower,
                period_id: periodData?.id || null,
                entry_date: initialBalanceForm.date || `${selectedYear}-${selectedMonth}-01`,
                concept: 'Saldo Inicial',
                tipo: 'SALDO_INICIAL',
                amount_bs: parseFloat(initialBalanceForm.amount),
                source: 'saldo_inicial',
            });
            if (error) throw error;
            setShowInitialModal(false);
            setInitialBalanceForm({ amount: '', date: '' });
            await fetchEntries();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveManual = async () => {
        if (!manualForm.concept || !manualForm.amount) return;
        setSaving(true);
        try {
            const periodName = `${MONTHS_UPPER[parseInt(selectedMonth) - 1]} ${selectedYear}`;
            const { data: periodData } = await supabase
                .from('condo_periods').select('id')
                .eq('tower_id', selectedTower).eq('period_name', periodName).maybeSingle();

            const { error } = await supabase.from('cash_book_entries').insert({
                tower_id: selectedTower,
                period_id: periodData?.id || null,
                entry_date: manualForm.date,
                concept: manualForm.concept,
                tipo: manualForm.tipo,
                amount_bs: parseFloat(manualForm.amount),
                source: 'manual',
                notes: manualForm.notes || null,
            });
            if (error) throw error;
            setShowManualModal(false);
            setManualForm({ concept: '', tipo: 'MANUAL_ENTRADA', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
            await fetchEntries();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Deseas eliminar esta transacción?')) return;
        await supabase.from('cash_book_entries').delete().eq('id', id);
        await fetchEntries();
    };

    // Compute running balance
    const enrichedEntries = useMemo(() => {
        let balance = 0;
        return entries.map(e => {
            if (e.tipo === 'SALDO_INICIAL') {
                balance = e.amount_bs;
                return { ...e, _entrada: null, _salida: null, _saldo: balance };
            } else if (e.tipo === 'ENTRADA' || e.tipo === 'MANUAL_ENTRADA') {
                balance += e.amount_bs;
                return { ...e, _entrada: e.amount_bs, _salida: null, _saldo: balance };
            } else {
                balance -= e.amount_bs;
                return { ...e, _entrada: null, _salida: e.amount_bs, _saldo: balance };
            }
        });
    }, [entries]);

    const totalEntradas = enrichedEntries.reduce((s, e) => s + (e._entrada || 0), 0);
    const totalSalidas = enrichedEntries.reduce((s, e) => s + (e._salida || 0), 0);
    const saldoFinal = enrichedEntries.length > 0 ? enrichedEntries[enrichedEntries.length - 1]._saldo : 0;
    const hasInitial = entries.some(e => e.tipo === 'SALDO_INICIAL');

    const sourceIcon = (source) => {
        const map = { cobranza: { icon: 'payments', color: 'text-emerald-500', label: 'Cobranza' }, gasto: { icon: 'receipt_long', color: 'text-red-400', label: 'Gasto' }, banco: { icon: 'account_balance', color: 'text-amber-500', label: 'Banco' }, manual: { icon: 'edit', color: 'text-slate-400', label: 'Manual' }, saldo_inicial: { icon: 'flag', color: 'text-blue-500', label: 'Saldo Inicial' } };
        return map[source] || map.manual;
    };

    return (
        <div className="p-4 sm:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f8fafc] dark:bg-[#020617] animate-in fade-in duration-700">
            {/* Page Header - Social VIVO Style */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Finanzas En Vivo</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
                        Libro de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600">Caja & Banco</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-2xl">
                        Gestión premium de movimientos bancarios y efectivo. Control absoluto de la liquidez en tiempo real.
                    </p>
                </div>

                {/* Main Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                    {userRole !== 'VISOR' && (
                        <>
                            {!hasInitial && (
                                <button onClick={() => setShowInitialModal(true)}
                                    className="px-6 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex items-center gap-3 group">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <span className="material-icons text-emerald-500">flag</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Apertura</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Saldo Inicial</p>
                                    </div>
                                </button>
                            )}
                            <button onClick={() => setShowManualModal(true)}
                                className="px-6 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex items-center gap-3 group">
                                <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <span className="material-icons text-slate-500">add_circle</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Manual</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nuevo Movimiento</p>
                                </div>
                            </button>
                            <button onClick={handleSync} disabled={syncing}
                                className="px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center gap-3 group disabled:opacity-60">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
                                    <span className={`material-icons text-white ${syncing ? 'animate-spin' : ''}`}>{syncing ? 'sync' : 'cloud_download'}</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-black text-white/70 uppercase tracking-widest">Automático</p>
                                    <p className="text-sm font-bold text-white uppercase">{syncing ? 'Sincronizando...' : 'Cargar Período'}</p>
                                </div>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Filter Bar - Social Card Style */}
            <div className="mb-10 p-2 rounded-[2rem] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-white dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <span className="material-icons text-emerald-500 text-sm">business</span>
                    <select value={selectedTower} onChange={e => setSelectedTower(e.target.value)}
                        className="bg-transparent border-none text-sm font-black text-slate-700 dark:text-white focus:ring-0 cursor-pointer">
                        {activeTowers.map(t => <option key={t.name} value={t.name}>TOW {t.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <span className="material-icons text-emerald-400 text-sm">calendar_month</span>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                        className="bg-transparent border-none text-sm font-black text-slate-700 dark:text-white focus:ring-0 cursor-pointer uppercase tracking-wider">
                        {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <span className="material-icons text-teal-500 text-sm">event</span>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                        className="bg-transparent border-none text-sm font-black text-slate-700 dark:text-white focus:ring-0 cursor-pointer">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <div className="ml-auto flex items-center gap-3 px-4">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado de Caja</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-700 dark:text-white">ACTIVO</span>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>

            {successMsg && (
                <div className={`mb-8 px-6 py-4 rounded-2xl text-sm font-black flex items-center gap-3 animate-in slide-in-from-top-4 duration-500 shadow-xl ${successMsg.startsWith('✅') ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                    successMsg.startsWith('ℹ️') ? 'bg-indigo-500 text-white shadow-indigo-500/20' :
                        'bg-pink-500 text-white shadow-pink-500/20'}`}>
                    <span className="material-icons">info</span>
                    {successMsg}
                </div>
            )}

            {/* Banner: Arrastre de Saldo disponible */}
            {prevMonthBalance && !hasInitial && userRole !== 'VISOR' && (
                <div className="mb-10 p-6 rounded-[2rem] bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-500/20 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="w-16 h-16 rounded-[2rem] bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                        <span className="material-icons text-3xl">transit_enterexit</span>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h4 className="text-xl font-black tracking-tight mb-1">Arrastre de Saldo Pendiente</h4>
                        <p className="text-white/80 font-medium">
                            Se detectó un saldo final de <span className="text-white font-black underline decoration-emerald-400 underline-offset-4">{formatBs(prevMonthBalance.amount)}</span> en {prevMonthBalance.monthLabel}.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleCarryForward} disabled={carryingForward}
                            className="px-8 py-3 rounded-2xl bg-white text-emerald-600 font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95">
                            {carryingForward ? <span className="material-icons animate-spin">sync</span> : <span className="material-icons">download</span>}
                            Sincronizar {formatBs(prevMonthBalance.amount)}
                        </button>
                        <button onClick={() => setPrevMonthBalance(null)} className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-all">
                            <span className="material-icons">close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Summary Cards - Glass Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {[
                    { label: 'Ingresos Totales', val: totalEntradas, color: 'from-emerald-400 to-emerald-600', icon: 'trending_up', bg: 'emerald' },
                    { label: 'Egresos Totales', val: totalSalidas, color: 'from-teal-500 to-emerald-600', icon: 'trending_down', bg: 'teal' },
                    { label: 'Remanente de Caja', val: saldoFinal, color: 'from-emerald-600 to-teal-800', icon: 'account_balance_wallet', bg: 'emerald' }
                ].map((stat, i) => (
                    <div key={i} className="group relative p-8 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-1 transition-all duration-500 overflow-hidden">
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.bg}-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700`}></div>
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-14 h-14 rounded-2xl bg-${stat.bg}-500/10 flex items-center justify-center`}>
                                <span className={`material-icons bg-gradient-to-br ${stat.color} bg-clip-text text-transparent text-3xl`}>{stat.icon}</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <div className="relative">
                            <h3 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-1">
                                {formatBs(stat.val)}
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full bg-${stat.bg}-500 animate-pulse`}></div>
                                <span className="text-xs font-bold text-slate-400">Actualizado ahora</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Table Content - Social Board Style */}
            <div className="relative rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50">
                        <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center animate-bounce shadow-xl shadow-emerald-500/20">
                            <span className="material-icons text-white text-4xl animate-spin">sync</span>
                        </div>
                        <p className="mt-6 text-xl font-black tracking-tighter text-slate-900 dark:text-white">Actualizando Registros...</p>
                        <p className="text-slate-500 font-medium">Un momento por favor</p>
                    </div>
                ) : enrichedEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center h-full px-6">
                        <div className="w-24 h-24 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-8 border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <span className="material-icons text-5xl text-slate-300 dark:text-slate-600">account_balance_wallet</span>
                        </div>
                        <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">No se encontraron movimientos</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-10 leading-relaxed font-medium">
                            Este libro de caja está listo para ser cargado. Seleccione un período o agregue transacciones manualmente para comenzar a gestionar el flujo.
                        </p>
                        <div className="flex items-center gap-4">
                            <button onClick={handleSync} className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                                CARGAR DESDE {MONTHS_UPPER[parseInt(selectedMonth) - 1]}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="max-h-[600px] overflow-y-auto overflow-x-auto custom-scrollbar relative">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/90 backdrop-blur-xl sticky top-0 z-20 border-b border-slate-100 dark:border-slate-800 shadow-sm">
                                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] w-16">ID</th>
                                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Fecha</th>
                                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Origen & Concepto</th>
                                    <th className="px-8 py-6 text-right text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Entradas (+)</th>
                                    <th className="px-8 py-6 text-right text-[10px] font-black text-pink-500 uppercase tracking-[0.3em]">Salidas (-)</th>
                                    <th className="px-8 py-6 text-right text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Balance</th>
                                    <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] w-20">Acc.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {enrichedEntries.map((e, idx) => {
                                    const src = sourceIcon(e.source);
                                    const isInitial = e.tipo === 'SALDO_INICIAL';
                                    return (
                                        <tr key={e.id} className={`group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all duration-300 ${isInitial ? 'bg-emerald-50/20 dark:bg-emerald-900/5' : ''}`}>
                                            <td className="px-8 py-6 text-xs font-black text-slate-300 dark:text-slate-600 tracking-widest">{isInitial ? '—' : String(idx + 1).padStart(2, '0')}</td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                                                        {new Date(e.entry_date + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }).toUpperCase()}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-slate-400">{new Date(e.entry_date + 'T12:00:00').getFullYear()}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform ${src.color}`}>
                                                        <span className="material-icons text-xl">{src.icon}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1 leading-tight">{e.concept}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${src.color}/70`}>{src.label}</span>
                                                            {e.notes && (
                                                                <>
                                                                    <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                                    <span className="text-[10px] font-medium text-slate-400 italic line-clamp-1">{e.notes}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <span className={`text-base font-black tracking-tight ${isInitial ? 'text-emerald-700 dark:text-emerald-300' : e._entrada !== null ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700'}`}>
                                                    {isInitial ? formatBs(e.amount_bs) : e._entrada !== null ? `+${formatBs(e._entrada).replace('Bs ', '')}` : '—'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <span className={`text-base font-black tracking-tight ${!isInitial && e._salida !== null ? 'text-rose-500 dark:text-rose-400' : 'text-slate-300 dark:text-slate-700'}`}>
                                                    {!isInitial && e._salida !== null ? `-${formatBs(e._salida).replace('Bs ', '')}` : '—'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-lg font-black tracking-tighter ${e._saldo >= 0 ? 'text-slate-900 dark:text-white' : 'text-pink-600'}`}>
                                                        {formatBs(e._saldo)}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <div className={`w-1 h-1 rounded-full ${e._saldo >= 0 ? 'bg-emerald-500' : 'bg-pink-500'}`}></div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Real-Time</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {userRole !== 'VISOR' && (e.source === 'manual' || e.source === 'saldo_inicial') ? (
                                                        <button onClick={() => handleDelete(e.id)}
                                                            className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-500 hover:bg-pink-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <span className="material-icons text-sm">delete_outline</span>
                                                        </button>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center">
                                                            <span className="material-icons text-sm">lock</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Sticky Footer: Totales Estética Social VIVO */}
                {!loading && enrichedEntries.length > 0 && (
                    <div className="sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-8 grid grid-cols-1 md:grid-cols-4 items-center gap-8 shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <span className="material-icons text-white">analytics</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Reporte Detallado</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cierre {MONTHS[parseInt(selectedMonth) - 1]}</p>
                            </div>
                        </div>

                        <div className="text-right border-r border-slate-100 dark:border-slate-800 md:pr-8 last:border-0">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Ahorro / Entradas</p>
                            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{formatBs(totalEntradas)}</span>
                        </div>

                        <div className="text-right border-r border-slate-100 dark:border-slate-800 md:pr-8 last:border-0">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">Gastos / Salidas</p>
                            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{formatBs(totalSalidas)}</span>
                        </div>

                        <div className="text-right">
                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${saldoFinal >= 0 ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}`}>Saldo Final Consolidado</p>
                            <span className={`text-4xl font-black tracking-tighter ${saldoFinal >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>{formatBs(saldoFinal)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Saldo Inicial - Social VIVO Style */}
            {showInitialModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowInitialModal(false)}></div>
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 relative overflow-hidden border border-white dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-12 translate-x-12 blur-2xl"></div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                <span className="material-icons text-emerald-500 text-3xl">flag</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Saldo Inicial</h3>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Apertura de Período</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Fecha de Apertura</label>
                                <div className="relative">
                                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">calendar_today</span>
                                    <input type="date" value={initialBalanceForm.date} onChange={e => setInitialBalanceForm(p => ({ ...p, date: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-white text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Monto Disponible (Bs)</label>
                                <div className="relative">
                                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">account_balance_wallet</span>
                                    <input type="number" min="0" step="0.01" value={initialBalanceForm.amount} onChange={e => setInitialBalanceForm(p => ({ ...p, amount: e.target.value }))}
                                        placeholder="0.00" className="w-full pl-11 pr-4 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-white text-xl font-black focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setShowInitialModal(false)}
                                className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95">
                                Cancelar
                            </button>
                            <button onClick={handleSaveInitialBalance} disabled={saving || !initialBalanceForm.amount}
                                className="flex-[1.5] py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50">
                                {saving ? 'GUARDANDO...' : 'CONFIRMAR APERTURA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Transacción Manual - Social VIVO Style */}
            {showManualModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowManualModal(false)}></div>
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 relative overflow-hidden border border-white dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -translate-y-12 translate-x-12 blur-2xl"></div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                <span className="material-icons text-emerald-500 text-3xl">add_circle</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Nuevo Movimiento</h3>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Registro Manual</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Tipo de Operación</label>
                                <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
                                    {[
                                        { v: 'MANUAL_ENTRADA', label: 'Ingreso', icon: 'arrow_upward', color: 'bg-emerald-500' },
                                        { v: 'MANUAL_SALIDA', label: 'Egreso', icon: 'arrow_downward', color: 'bg-rose-500' }
                                    ].map(opt => (
                                        <button key={opt.v} onClick={() => setManualForm(p => ({ ...p, tipo: opt.v }))}
                                            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${manualForm.tipo === opt.v ? `${opt.color} text-white shadow-lg` : 'text-slate-500 hover:bg-white dark:hover:bg-slate-700'
                                                }`}>
                                            <span className="material-icons text-[14px]">{opt.icon}</span>
                                            {opt.label.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Fecha</label>
                                    <input type="date" value={manualForm.date} onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-white text-xs font-bold focus:ring-2 focus:ring-violet-500/20 transition-all outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Monto (Bs)</label>
                                    <input type="number" min="0" step="0.01" value={manualForm.amount} onChange={e => setManualForm(p => ({ ...p, amount: e.target.value }))}
                                        placeholder="0.00" className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-white text-sm font-black focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Concepto / Descripción</label>
                                <input type="text" value={manualForm.concept} onChange={e => setManualForm(p => ({ ...p, concept: e.target.value }))}
                                    placeholder="Ej: Mantenimiento de Ascensores" className="w-full px-4 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-white text-sm font-bold focus:ring-2 focus:ring-violet-500/20 transition-all outline-none" />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Observaciones (Opcional)</label>
                                <textarea value={manualForm.notes} onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Detalles adicionales o referencias..." rows="2"
                                    className="w-full px-4 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-white text-sm font-medium focus:ring-2 focus:ring-violet-500/20 transition-all outline-none resize-none" />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setShowManualModal(false)}
                                className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95">
                                Cancelar
                            </button>
                            <button onClick={handleSaveManual} disabled={saving || !manualForm.concept || !manualForm.amount}
                                className="flex-[1.5] py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 text-white font-black text-sm active:scale-95 transition-all disabled:opacity-50">
                                {saving ? 'GUARDANDO...' : 'REGISTRAR OPERACIÓN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashBook;
