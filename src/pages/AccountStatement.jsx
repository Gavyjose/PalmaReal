import React, { useState } from 'react';
import useSWR from 'swr';
import { supabase } from '../supabase';
import CSVImporter from '../components/CSVImporter';

// Format Bs currency
const formatBs = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Bs. 0,00';
    return 'Bs. ' + Number(amount).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const fetchTowersFetcher = async () => {
    const { data } = await supabase
        .from('towers')
        .select('name')
        .eq('is_active', true)
        .order('name');
    return data ? data.map(t => t.name) : [];
};

const fetchAccountDataFetcher = async ([_, selectedTower, selectedMonth, selectedYear]) => {
    if (!selectedTower || !selectedMonth || !selectedYear) return null;

    const startDate = `${selectedYear}-${selectedMonth}-01`;
    const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).toISOString().split('T')[0];

    // 1. Fetch Bank Transactions
    const { data: bankData, error: bankError } = await supabase
        .from('bank_transactions')
        .select('id, transaction_date, description, amount, reference, status, matched_payment_id, match_type')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });

    if (bankError) console.error('Bank fetch error:', bankError);

    // 2. Fetch System Payments in Bs (By Tower & Date)
    let systemData = [];

    const { data: towerUnits, error: towerErr } = await supabase
        .from('units')
        .select('id, number')
        .eq('tower', selectedTower);

    if (towerErr) {
        console.error('Error fetching tower units:', towerErr.message);
    } else if (towerUnits && towerUnits.length > 0) {
        const unitIds = towerUnits.map(u => u.id);
        const unitMap = {};
        towerUnits.forEach(u => { unitMap[u.id] = u.number; });

        // Step 2a: Query INCOME (unit_payments)
        const { data: incomeData, error: incomeError } = await supabase
            .from('unit_payments')
            .select('id, unit_id, amount_bs, amount_usd, bcv_rate, payment_date, reference, status')
            .in('unit_id', unitIds)
            .gte('payment_date', startDate)
            .lte('payment_date', endDate)
            .order('payment_date', { ascending: false });

        if (!incomeError) {
            systemData.push(...(incomeData || []).map(p => ({
                ...p,
                _unitNumber: unitMap[p.unit_id],
                _type: 'INCOME'
            })));
        }

        // Step 2b: Query EXPENSES (period_expenses)
        const periodName = `${MONTHS[parseInt(selectedMonth) - 1]} ${selectedYear}`.toUpperCase();
        const { data: periods, error: periodsError } = await supabase
            .from('condo_periods')
            .select('id')
            .eq('tower_id', selectedTower)
            .eq('period_name', periodName);

        if (!periodsError && periods && periods.length > 0) {
            const periodIds = periods.map(p => p.id);
            const { data: expenseData, error: expenseError } = await supabase
                .from('period_expenses')
                .select('id, description, amount_bs, amount_usd_at_payment, bcv_rate_at_payment, payment_date, bank_reference, payment_status')
                .in('period_id', periodIds)
                .eq('payment_status', 'PAGADO');

            if (!expenseError) {
                systemData.push(...(expenseData || []).map(e => ({
                    id: e.id,
                    unit_id: null,
                    amount_bs: e.amount_bs,
                    amount_usd: e.amount_usd_at_payment,
                    bcv_rate: e.bcv_rate_at_payment,
                    payment_date: e.payment_date,
                    reference: e.bank_reference,
                    status: e.payment_status,
                    _description: e.description,
                    _type: 'EXPENSE'
                })));
            }
        }
    }

    // 3. Process Bank Data
    const formattedBank = (bankData || []).map(tx => ({
        id: tx.id,
        date: tx.transaction_date,
        description: tx.description || 'Sin descripción',
        amount: parseFloat(tx.amount) || 0,
        reference: tx.reference || '-',
        match_type: tx.match_type,
        status: tx.status === 'MATCHED' ? 'verified' : (tx.status === 'IGNORED' ? 'ignored' : 'unmatched')
    }));

    // 4. Process System Data - show in Bs
    const matchInfoMap = new Map();
    (bankData || []).forEach(tx => {
        if (tx.matched_payment_id) {
            matchInfoMap.set(tx.matched_payment_id, tx.match_type);
        }
    });

    const formattedSystem = systemData.map(p => {
        const amountBs = parseFloat(p.amount_bs) || 0;
        const amountUsd = parseFloat(p.amount_usd) || 0;
        const bcvRate = parseFloat(p.bcv_rate) || 0;
        const displayBs = amountBs > 0 ? amountBs : (amountUsd * (bcvRate || 1));

        const rawStatus = (p.status || '').toUpperCase();
        let status = (rawStatus === 'VERIFIED' || rawStatus === 'PAGADO') ? 'verified' : 'pending';

        const matchType = matchInfoMap.get(p.id);
        if (matchInfoMap.has(p.id)) status = 'verified';

        const description = p._type === 'EXPENSE'
            ? `GASTO: ${p._description}`
            : `Apto ${p._unitNumber || '?'}`;

        return {
            id: p.id,
            ref: p.reference || '-',
            description: description,
            date: p.payment_date,
            amount_bs: p._type === 'EXPENSE' ? -displayBs : displayBs,
            amount_usd: p._type === 'EXPENSE' ? -amountUsd : amountUsd,
            bcv_rate: bcvRate,
            status,
            type: p._type,
            match_type: matchType
        };
    });

    formattedSystem.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 5. Calculate Stats in Bs
    const totalBank = formattedBank.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSystem = formattedSystem.reduce((sum, p) => sum + (p.amount_bs || p.amount_usd), 0);

    // 6. Identify Bank Commissions
    const COMMISSION_KEYWORDS = [
        'COMISION', 'COMIS.', 'MANTENIMIENTO DE CUENTA', 'USO DEL CANAL', 'SMS',
        'ITF', 'GASTOS ADMINISTRATIVOS', 'CARGO POR MANTENIMIENTO'
    ];

    const commissions = formattedBank.filter(tx => {
        const desc = tx.description.toUpperCase();
        return tx.amount < 0 && COMMISSION_KEYWORDS.some(kw => desc.includes(kw));
    });

    const totalCommissions = commissions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    return {
        bankTransactions: formattedBank,
        systemTransactions: formattedSystem,
        commissionDetails: commissions,
        stats: {
            bankBalance: totalBank,
            systemBalance: totalSystem,
            difference: totalBank - totalSystem,
            bankCommissions: totalCommissions
        }
    };
};

const AccountStatement = () => {
    // Filters
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
    const [showCommissionsDetail, setShowCommissionsDetail] = useState(false);
    const [isMutating, setIsMutating] = useState(false);

    // 1. Fetch Towers
    const { data: towers = [] } = useSWR('towers', fetchTowersFetcher);

    // Automatically select the first tower once towers are loaded if no selection exists
    const [localSelectedTower, setLocalSelectedTower] = useState('');
    const selectedTower = localSelectedTower || (towers.length > 0 ? towers[0] : '');

    // 2. Fetch Account Data (Dependent Fetching)
    const { data: accountData, isLoading: isDataLoading, mutate: mutateAccountData } = useSWR(
        selectedTower ? ['accountData', selectedTower, selectedMonth, selectedYear] : null,
        fetchAccountDataFetcher
    );

    const loading = isDataLoading || isMutating;

    // Derived State
    const bankTransactions = accountData?.bankTransactions || [];
    const systemTransactions = accountData?.systemTransactions || [];
    const commissionDetails = accountData?.commissionDetails || [];
    const stats = accountData?.stats || {
        bankBalance: 0,
        systemBalance: 0,
        difference: 0,
        bankCommissions: 0
    };

    const handleClearBankTransactions = async () => {
        if (!confirm('¿Estás seguro de que deseas borrar TODOS los movimientos bancarios importados? Esto no borrará los pagos del sistema.')) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('bank_transactions')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (error) throw error;
            alert('✅ Extracto bancario borrado exitosamente.');
            mutateAccountData();
        } catch (error) {
            console.error('Clear bank error:', error);
            alert('Error al borrar: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const handleResetConciliation = async () => {
        if (!confirm('¿Estás seguro de que deseas borrar todas las marcas de conciliación de este mes?')) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('bank_transactions')
                .update({ status: 'PENDING', matched_payment_id: null })
                .eq('status', 'MATCHED'); // Reset all matched for now, or we could filter by date

            if (error) throw error;
            alert('✅ Marcas de conciliación eliminadas.');
            mutateAccountData();
        } catch (error) {
            console.error('Reset error:', error);
            alert('Error al resetear: ' + error.message);
        } finally {
            setIsMutating(false);
        }
    };

    const handleSaveBankCommissions = async () => {
        try {
            const startDate = `${selectedYear}-${selectedMonth}-01`;
            const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).toISOString().split('T')[0];

            const { data: bankData, error: bankError } = await supabase
                .from('bank_transactions')
                .select('description, amount')
                .gte('transaction_date', startDate)
                .lte('transaction_date', endDate);

            if (bankError) throw bankError;

            const COMMISSION_KEYWORDS = [
                'COMISION', 'COMIS.', 'MANTENIMIENTO', 'USO DEL CANAL',
                'SMS', 'ITF', 'GASTOS ADMINISTRATIVOS', 'CARGO POR MANTENIMIENTO',
                'BANCAREA', 'BANCARIA'
            ];

            const totalCommissions = (bankData || [])
                .filter(tx => {
                    const desc = (tx.description || '').toUpperCase();
                    return tx.amount < 0 && COMMISSION_KEYWORDS.some(kw => desc.includes(kw));
                })
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

            // Formato: "FEBRERO 2026" (igual que AliquotsConfig)
            const monthName = MONTHS[parseInt(selectedMonth) - 1].toUpperCase();
            const periodName = `${monthName} ${selectedYear}`;

            const { data: period, error: periodError } = await supabase
                .from('condo_periods')
                .select('id')
                .eq('period_name', periodName)
                .maybeSingle();

            if (periodError) throw periodError;

            let periodId = period?.id;

            if (!period) {
                // Obtener el ID de la torre a partir del nombre
                const { data: towerData } = await supabase
                    .from('towers')
                    .select('id')
                    .eq('name', selectedTower)
                    .single();

                if (!towerData) {
                    console.warn('⚠️ No se encontró la torre');
                    return;
                }

                const { data: newPeriod, error: createError } = await supabase
                    .from('condo_periods')
                    .insert({
                        tower_id: towerData.id,
                        period_name: periodName,
                        status: 'BORRADOR',
                        reserve_fund: 0,
                        bank_commissions_total_bs: totalCommissions
                    })
                    .select('id')
                    .single();

                if (createError) throw createError;
                periodId = newPeriod.id;
                console.log(`✅ Periodo creado y comisiones guardadas: Bs. ${totalCommissions.toLocaleString('es-VE')}`);
            } else {
                const { error: updateError } = await supabase
                    .from('condo_periods')
                    .update({ bank_commissions_total_bs: totalCommissions })
                    .eq('id', period.id);

                if (updateError) throw updateError;
                console.log(`✅ Comisiones bancarias guardadas: Bs. ${totalCommissions.toLocaleString('es-VE')}`);
            }
        } catch (error) {
            console.error('Error guardando comisiones bancarias:', error);
        }
    };

    const handleAutoConciliation = async () => {
        const pendingBank = bankTransactions.filter(tx => tx.status === 'unmatched');
        let matchesFound = 0;
        const usedSystemIds = new Set();

        // PHASE 1: Strong Match (Reference 6 digits)
        const phase1Matches = [];
        for (const bankTx of pendingBank) {
            const match = systemTransactions.find(sysTx => {
                if (sysTx.status !== 'pending' || usedSystemIds.has(sysTx.id)) return false;

                const bankRef = (bankTx.reference || '').toString().trim();
                const sysRef = (sysTx.ref || '').toString().trim();
                const bank6 = bankRef.slice(-6);
                const sys6 = sysRef.slice(-6);

                return bank6.length === 6 && sys6.length === 6 && bank6 === sys6;
            });

            if (match) {
                phase1Matches.push({ bankTx, match, type: 'REFERENCE' });
                usedSystemIds.add(match.id);
            }
        }

        // PHASE 2: Smart Match (Amount + Date Proximity)
        const remainingBank = pendingBank.filter(btx => !phase1Matches.find(m => m.bankTx.id === btx.id));
        const phase2Matches = [];

        for (const bankTx of remainingBank) {
            const candidates = systemTransactions.filter(sysTx => {
                if (sysTx.status !== 'pending' || usedSystemIds.has(sysTx.id)) return false;

                // Amount match (allow small rounding diff if needed, but the user said amount doesn't change)
                const amountMatch = Math.abs(Math.abs(sysTx.amount_bs) - Math.abs(bankTx.amount)) < 0.01;

                // Date proximity (5 days)
                const bankDate = new Date(bankTx.date);
                const sysDate = new Date(sysTx.date);
                const diffTime = Math.abs(sysDate - bankDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return amountMatch && diffDays <= 5;
            });

            // IMPORTANT: Only auto-match IF there is exactly ONE candidate
            if (candidates.length === 1) {
                const match = candidates[0];
                phase2Matches.push({ bankTx, match, type: 'AMOUNT' });
                usedSystemIds.add(match.id);
            }
        }

        const allMatches = [...phase1Matches, ...phase2Matches];

        if (allMatches.length === 0) {
            alert('No se encontraron coincidencias automáticas (Referencia o Monto/Fecha).');
            return;
        }

        try {
            setLoading(true);
            for (const m of allMatches) {
                // Update bank side
                await supabase
                    .from('bank_transactions')
                    .update({
                        status: 'MATCHED',
                        matched_payment_id: m.match.id,
                        match_type: m.type // New column for tracking
                    })
                    .eq('id', m.bankTx.id);

                // Update system side if INCOME
                if (m.match.type === 'INCOME') {
                    await supabase
                        .from('unit_payments')
                        .update({ status: 'VERIFIED' })
                        .eq('id', m.match.id);
                }
            }

            alert(`✅ Se conciliaron ${allMatches.length} movimientos.\n- ${phase1Matches.length} por Referencia\n- ${phase2Matches.length} por Monto y Fecha`);
            mutateAccountData();
        } catch (err) {
            console.error('Auto reconciliation error:', err);
            alert('Error durante la conciliación: ' + err.message);
        } finally {
            setIsMutating(false);
        }
    };

    const conciliatedCount = systemTransactions.filter(t => t.status === 'verified').length;
    const pendingCount = systemTransactions.filter(t => t.status === 'pending').length;

    return (
        <div className="max-w-[1600px] mx-auto p-6 space-y-6">
            {/* Unified Filter & Stats Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                    {/* Filters Group */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="material-icons text-slate-400 text-lg">location_city</span>
                            <select
                                value={localSelectedTower || selectedTower}
                                onChange={(e) => setLocalSelectedTower(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm cursor-pointer"
                            >
                                <option value="">Torre</option>
                                {towers.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="material-icons text-slate-400 text-lg">calendar_month</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm cursor-pointer"
                            >
                                {MONTHS.map((name, i) => {
                                    const m = String(i + 1).padStart(2, '0');
                                    return <option key={m} value={m}>{name}</option>;
                                })}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 dark:text-white outline-none text-sm cursor-pointer border-l border-slate-300 dark:border-slate-600 ml-1 pl-2"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={String(y)}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden lg:block"></div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleClearBankTransactions}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 p-2 rounded-xl hover:bg-slate-100 transition-all"
                                title="Limpiar Banco"
                            >
                                <span className="material-icons text-sm">delete_sweep</span>
                            </button>
                            <button
                                onClick={handleResetConciliation}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all"
                                title="Reiniciar Conciliación"
                            >
                                <span className="material-icons text-sm">history</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Group - Leveraging that space */}
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-3 lg:border-l lg:border-slate-200 lg:dark:border-slate-700 lg:pl-6">
                        <div className="flex-1 min-w-[140px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-right">Banco</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums text-right">{formatBs(stats.bankBalance)}</p>
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-right">Sistema</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums text-right">{formatBs(stats.systemBalance)}</p>
                        </div>
                        <div
                            onClick={() => setShowCommissionsDetail(!showCommissionsDetail)}
                            className="flex-1 min-w-[140px] cursor-pointer group"
                        >
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-right flex items-center justify-end gap-1">
                                <span className="material-icons text-[10px] text-red-400">info</span>
                                Comisiones
                            </p>
                            <p className="text-sm font-black text-red-500 tabular-nums text-right group-hover:underline underline-offset-4">{formatBs(-stats.bankCommissions)}</p>
                        </div>
                        <div className={`flex-1 min-w-[150px] px-3 py-1.5 rounded-xl border ${stats.difference === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Diferencia</p>
                            <p className={`text-sm font-black tabular-nums text-center ${stats.difference === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {formatBs(stats.difference)}
                            </p>
                        </div>
                    </div>
                </div>
                {loading && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-primary text-xs font-semibold animate-pulse">
                        <span className="material-icons animate-spin text-sm">sync</span>
                        SINCRONIZANDO DATOS DE TORRE {selectedTower}...
                    </div>
                )}
            </div>

            {/* Commissions Breakdown Section */}
            {showCommissionsDetail && (
                <div className="bg-red-50/50 dark:bg-red-900/5 border border-red-200 dark:border-red-900/30 rounded-2xl p-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-red-500">analytics</span>
                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">Desglose de Gastos y Comisiones Bancarias</h3>
                        </div>
                        <button
                            onClick={() => setShowCommissionsDetail(false)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-icons">close</span>
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {commissionDetails.length > 0 ? (
                            commissionDetails.map(item => (
                                <div key={item.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-red-100 dark:border-red-900/20 flex justify-between items-center shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(item.date + 'T12:00:00').toLocaleDateString('es-VE')}</span>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase truncate max-w-[180px]">{item.description}</span>
                                    </div>
                                    <span className="text-sm font-black text-red-500 tabular-nums">{formatBs(item.amount)}</span>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-4 text-center text-slate-400 italic text-sm">No se detectaron comisiones automáticas en el rango actual.</div>
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-red-100 dark:border-red-900/20 flex justify-end">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Total Gastos Bancarios</p>
                            <p className="text-lg font-black text-red-600 tabular-nums">{formatBs(-stats.bankCommissions)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 w-full">
                <div className="flex items-center gap-2">
                    <CSVImporter onImportSuccess={async () => {
                        await mutateAccountData();
                        await handleSaveBankCommissions();
                    }} />
                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button className="px-3 py-1 text-xs font-bold bg-primary text-white rounded-md">Vista Dividida</button>
                        <button className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-300">Historial</button>
                    </div>
                </div>
                <button
                    onClick={handleAutoConciliation}
                    className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-5 py-2.5 rounded-lg text-sm font-bold transition-all border border-primary/30 cursor-pointer"
                >
                    <span className="material-icons text-xl">auto_fix_high</span>
                    <span>Conciliación Automática</span>
                </button>
            </div>

            {/* Main Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-400px)] min-h-[500px]">
                {/* Left: Bank Statement */}
                <div className="flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-primary">account_balance</span>
                            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-widest">Extracto Bancario</h3>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500 px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-500/20 uppercase">
                            {bankTransactions.length} movimientos
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                                <tr className="text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-4 py-3 font-semibold">Fecha</th>
                                    <th className="px-4 py-3 font-semibold">Concepto</th>
                                    <th className="px-4 py-3 font-semibold">Referencia</th>
                                    <th className="px-4 py-3 font-semibold text-right">Monto (Bs.)</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {bankTransactions.map(tx => (
                                    <tr key={tx.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${tx.status === 'unmatched' ? 'border-l-4 border-l-amber-400' : ''}`}>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums text-xs">
                                            {new Date(tx.date + 'T12:00:00').toLocaleDateString('es-VE')}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200 text-xs">
                                            {tx.description}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-emerald-400 text-[11px] font-bold">
                                            {tx.reference}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold tabular-nums text-xs ${tx.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {tx.amount >= 0 ? '+' : ''}{formatBs(tx.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {tx.status === 'verified' && <span className="material-icons text-emerald-500 text-lg" title="Conciliado">check_circle</span>}
                                            {tx.status === 'unmatched' && <span className="material-icons text-amber-400 text-lg" title="Sin conciliar">radio_button_unchecked</span>}
                                            {tx.status === 'ignored' && <span className="material-icons text-slate-400 text-lg" title="Ignorado">remove_circle_outline</span>}
                                        </td>
                                    </tr>
                                ))}
                                {bankTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-10 text-center text-slate-400 text-sm">
                                            <span className="material-icons text-4xl block mb-2 text-slate-300">upload_file</span>
                                            No hay movimientos bancarios para este período.<br />
                                            Use el botón <b>"Cargar Extracto"</b> para importar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right: System Ledger in Bs */}
                <div className="flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-primary">analytics</span>
                            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-widest">Libro Mayor del Sistema</h3>
                        </div>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold border border-primary/20 uppercase">
                            {systemTransactions.length} registros
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                                <tr className="text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-3 py-3 text-center">Estado</th>
                                    <th className="px-3 py-3 font-semibold">Fecha</th>
                                    <th className="px-3 py-3 font-semibold">Concepto</th>
                                    <th className="px-3 py-3 font-semibold">Referencia</th>
                                    <th className="px-3 py-3 font-semibold text-right">Monto (Bs.)</th>
                                    <th className="px-3 py-3 font-semibold text-right text-xs text-slate-400">Tasa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {systemTransactions.map(tx => (
                                    <tr key={tx.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${tx.type === 'EXPENSE' ? 'border-r-4 border-r-red-500' : 'border-r-4 border-r-primary'
                                        }`}>
                                        <td className="px-3 py-3 text-center">
                                            {tx.status === 'verified'
                                                ? <span className="material-icons text-emerald-500 text-lg">check_circle</span>
                                                : <span className="material-icons text-amber-400 text-lg">pending</span>
                                            }
                                        </td>
                                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-[10px] text-center">
                                            {tx.date ? new Date(tx.date + 'T12:00:00').toLocaleDateString('es-VE') : '-'}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800 dark:text-white uppercase truncate max-w-[200px]" title={tx.description}>
                                                    {tx.description}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">REF: {tx.ref}</span>
                                                    {tx.match_type === 'AMOUNT' && (
                                                        <span className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded font-black border border-amber-100 uppercase" title="Emparejado por Monto y Fecha proximity">Fuzzy Match</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-3 py-3 text-right font-bold tabular-nums text-xs ${tx.amount_bs >= 0 ? 'text-emerald-500' : 'text-red-500'
                                            }`}>
                                            {tx.amount_bs >= 0 ? '+' : ''}{formatBs(tx.amount_bs)}
                                            <div className="text-[10px] opacity-70 font-normal">
                                                {tx.amount_usd >= 0 ? '+' : ''}{tx.amount_usd?.toFixed(2)}$
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-right text-slate-400 tabular-nums text-[10px]">
                                            {tx.bcv_rate ? `${tx.bcv_rate.toFixed(2)}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {systemTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-10 text-center text-slate-400 text-sm">
                                            <span className="material-icons text-4xl block mb-2 text-slate-300">receipt_long</span>
                                            No hay pagos registrados en el sistema<br />para Torre {selectedTower} en {MONTHS[parseInt(selectedMonth) - 1]} {selectedYear}.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Footer Summary */}
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-sm shadow-lg text-white">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-300">Conciliados: <b className="text-white">{conciliatedCount}</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                        <span className="text-slate-300">Pendientes: <b className="text-white">{pendingCount}</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-600"></span>
                        <span className="text-slate-300">Sin conciliar banco: <b className="text-white">{bankTransactions.filter(t => t.status === 'unmatched').length}</b></span>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <span className="material-icons text-sm">info</span>
                    <p>Conciliación por monto en Bs. y fecha ±4 días.</p>
                </div>
            </div>
        </div>
    );
};

export default AccountStatement;
