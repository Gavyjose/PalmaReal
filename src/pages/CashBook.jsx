import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useTowers } from '../hooks/useTowers';

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
        <div className="p-6 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="material-icons text-primary">account_balance_wallet</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Libro de Caja / Banco</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Mayor Auxiliar de Movimientos</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <select value={selectedTower} onChange={e => setSelectedTower(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {activeTowers.map(t => <option key={t.name} value={t.name}>Torre {t.name}</option>)}
                </select>
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                </select>
                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <div className="flex-1" />

                {/* Action Buttons */}
                {!hasInitial && (
                    <button onClick={() => setShowInitialModal(true)}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-2 transition-all">
                        <span className="material-icons text-sm">flag</span> Saldo Inicial
                    </button>
                )}
                <button onClick={() => setShowManualModal(true)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-bold flex items-center gap-2 transition-all">
                    <span className="material-icons text-sm">add</span> Agregar Manual
                </button>
                <button onClick={handleSync} disabled={syncing}
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-60">
                    <span className={`material-icons text-sm ${syncing ? 'animate-spin' : ''}`}>{syncing ? 'sync' : 'cloud_download'}</span>
                    {syncing ? 'Sincronizando...' : 'Cargar desde Período'}
                </button>
            </div>

            {successMsg && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-bold ${successMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : successMsg.startsWith('ℹ️') ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {successMsg}
                </div>
            )}

            {/* Banner: Arrastre de Saldo disponible */}
            {prevMonthBalance && !hasInitial && (
                <div className="mb-5 flex items-center gap-4 px-5 py-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
                    <span className="material-icons text-blue-500 text-2xl">arrow_forward</span>
                    <div className="flex-1">
                        <p className="text-sm font-black text-blue-800 dark:text-blue-300">
                            El saldo final de <span className="underline">{prevMonthBalance.monthLabel}</span> es <span className="font-black">{formatBs(prevMonthBalance.amount)}</span>
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">¿Deseas usarlo como Saldo Inicial de este mes?</p>
                    </div>
                    <button
                        onClick={handleCarryForward}
                        disabled={carryingForward}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-black flex items-center gap-2 transition-all disabled:opacity-60 whitespace-nowrap"
                    >
                        <span className="material-icons text-sm">{carryingForward ? 'sync' : 'done'}</span>
                        {carryingForward ? 'Aplicando...' : 'Arrastrar Saldo'}
                    </button>
                    <button onClick={() => setPrevMonthBalance(null)} className="text-blue-400 hover:text-blue-600 p-1">
                        <span className="material-icons text-sm">close</span>
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Total Entradas</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatBs(totalEntradas)}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-xs font-black text-red-500 dark:text-red-400 uppercase tracking-widest mb-1">Total Salidas</p>
                    <p className="text-2xl font-black text-red-600 dark:text-red-400">{formatBs(totalSalidas)}</p>
                </div>
                <div className={`${saldoFinal >= 0 ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'} border rounded-xl p-4`}>
                    <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Saldo Final</p>
                    <p className={`text-2xl font-black ${saldoFinal >= 0 ? 'text-slate-800 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`}>{formatBs(saldoFinal)}</p>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <span className="material-icons animate-spin text-4xl mr-3">sync</span>
                        <span className="font-bold">Cargando...</span>
                    </div>
                ) : enrichedEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <span className="material-icons text-5xl mb-3 opacity-30">account_balance_wallet</span>
                        <p className="font-bold text-base">Sin movimientos para este período</p>
                        <p className="text-sm mt-1">Usa "Cargar desde Período" o agrega una transacción manualmente.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-800 text-white text-[10px] uppercase font-black tracking-widest">
                                    <th className="px-4 py-3 text-left w-10">#</th>
                                    <th className="px-4 py-3 text-left">Fecha</th>
                                    <th className="px-4 py-3 text-left">Concepto</th>
                                    <th className="px-4 py-3 text-center">Fuente</th>
                                    <th className="px-4 py-3 text-right text-emerald-400">Entrada (Bs)</th>
                                    <th className="px-4 py-3 text-right text-red-400">Salida (Bs)</th>
                                    <th className="px-4 py-3 text-right">Saldo (Bs)</th>
                                    <th className="px-2 py-3 text-center w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {enrichedEntries.map((e, idx) => {
                                    const src = sourceIcon(e.source);
                                    const isInitial = e.tipo === 'SALDO_INICIAL';
                                    return (
                                        <tr key={e.id} className={`transition-colors group ${isInitial ? 'bg-blue-50/60 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                            <td className="px-4 py-3 text-slate-400 font-bold text-center">{isInitial ? '—' : idx}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                                                {new Date(e.entry_date + 'T12:00:00').toLocaleDateString('es-VE')}
                                            </td>
                                            <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium max-w-xs">
                                                <div>{e.concept}</div>
                                                {e.notes && <div className="text-xs text-slate-400 mt-0.5 italic">{e.notes}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase ${src.color}`}>
                                                    <span className="material-icons text-sm">{src.icon}</span>
                                                    <span className="hidden sm:inline">{src.label}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                {isInitial ? <span className="text-blue-600 dark:text-blue-400">{formatBs(e.amount_bs)}</span> : e._entrada !== null ? formatBs(e._entrada) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-red-500 dark:text-red-400 whitespace-nowrap">
                                                {!isInitial && e._salida !== null ? formatBs(e._salida) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-black whitespace-nowrap text-base ${e._saldo >= 0 ? 'text-slate-800 dark:text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                                                {formatBs(e._saldo)}
                                            </td>
                                            <td className="px-2 py-3 text-center">
                                                {(e.source === 'manual' || e.source === 'saldo_inicial') && (
                                                    <button onClick={() => handleDelete(e.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1 rounded">
                                                        <span className="material-icons text-sm">delete</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700 font-black text-sm">
                                    <td colSpan={4} className="px-4 py-4 text-right text-slate-600 dark:text-slate-300 uppercase tracking-wide text-xs">Totales del Período</td>
                                    <td className="px-4 py-4 text-right text-emerald-600 dark:text-emerald-400">{formatBs(totalEntradas)}</td>
                                    <td className="px-4 py-4 text-right text-red-500 dark:text-red-400">{formatBs(totalSalidas)}</td>
                                    <td className={`px-4 py-4 text-right text-lg ${saldoFinal >= 0 ? 'text-slate-900 dark:text-white' : 'text-amber-600'}`}>{formatBs(saldoFinal)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal: Saldo Inicial */}
            {showInitialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Establecer Saldo Inicial</h3>
                        <p className="text-sm text-slate-500 mb-5">Este es el monto que hay en la cuenta al inicio del período. Solo se ingresa una vez.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Fecha del Saldo Inicial</label>
                                <input type="date" value={initialBalanceForm.date} onChange={e => setInitialBalanceForm(p => ({ ...p, date: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Monto (Bs)</label>
                                <input type="number" min="0" step="0.01" value={initialBalanceForm.amount} onChange={e => setInitialBalanceForm(p => ({ ...p, amount: e.target.value }))}
                                    placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-bold" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowInitialModal(false)} className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Cancelar</button>
                            <button onClick={handleSaveInitialBalance} disabled={saving} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-60">
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Transacción Manual */}
            {showManualModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Agregar Transacción Manual</h3>
                        <p className="text-sm text-slate-500 mb-5">Para pagos o ingresos no registrados en el sistema.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Tipo</label>
                                <div className="flex gap-2">
                                    {[{ v: 'MANUAL_ENTRADA', label: 'Entrada', color: 'bg-emerald-500' }, { v: 'MANUAL_SALIDA', label: 'Salida', color: 'bg-red-500' }].map(opt => (
                                        <button key={opt.v} onClick={() => setManualForm(p => ({ ...p, tipo: opt.v }))}
                                            className={`flex-1 py-2 rounded-lg text-sm font-black transition-all ${manualForm.tipo === opt.v ? `${opt.color} text-white` : 'border border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Fecha</label>
                                <input type="date" value={manualForm.date} onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Concepto</label>
                                <input type="text" value={manualForm.concept} onChange={e => setManualForm(p => ({ ...p, concept: e.target.value }))}
                                    placeholder="Ej: Pago de plomería" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Monto (Bs)</label>
                                <input type="number" min="0" step="0.01" value={manualForm.amount} onChange={e => setManualForm(p => ({ ...p, amount: e.target.value }))}
                                    placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Notas (opcional)</label>
                                <input type="text" value={manualForm.notes} onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Referencia u observaciones..." className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowManualModal(false)} className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Cancelar</button>
                            <button onClick={handleSaveManual} disabled={saving || !manualForm.concept || !manualForm.amount}
                                className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-sm disabled:opacity-60">
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashBook;
