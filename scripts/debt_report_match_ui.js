import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const monthMap = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
    'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
};

function buildFinancialLedger({
    initialDebtValue,
    condoPeriods,
    specialProjects,
    specialPayments,
    paymentsHistory = []
}) {
    let accumulatedDebt = 0;
    const totalPayments = (paymentsHistory || []).reduce((sum, p) => sum + parseFloat(p.amount_usd || 0), 0);
    const reservedForSpecial = (specialPayments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const parsedInitialDebt = parseFloat(initialDebtValue || 0);
    const startingCredit = parsedInitialDebt < 0 ? Math.abs(parsedInitialDebt) : 0;

    let commonFuel = totalPayments - reservedForSpecial + startingCredit;
    let rawCharges = [];

    if (parsedInitialDebt > 0) {
        rawCharges.push({ aliquot: parsedInitialDebt, sortKey: 0 });
    }

    const sortedPeriods = [...(condoPeriods || [])].sort((a, b) => {
        const partsA = a.period_name.split(' ');
        const partsB = b.period_name.split(' ');
        const yearA = parseInt(partsA[1]) || 0;
        const yearB = parseInt(partsB[1]) || 0;
        const monthA = monthMap[partsA[0].toUpperCase()] || 0;
        const monthB = monthMap[partsB[0].toUpperCase()] || 0;
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
    });

    sortedPeriods.forEach(period => {
        const parts = period.period_name.split(' ');
        const year = parseInt(parts[1]) || 0;
        const month = monthMap[parts[0].toUpperCase()] || 0;

        // Match the app's aliquot calculation
        const expTotal = (period.period_expenses || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        const aliquot = period.unit_aliquot_usd
            ? parseFloat(period.unit_aliquot_usd)
            : parseFloat(((expTotal + parseFloat(period.reserve_fund || 0)) / 16).toFixed(2));

        rawCharges.push({ aliquot, sortKey: year * 100 + month });
    });

    rawCharges.sort((a, b) => a.sortKey - b.sortKey);
    rawCharges.forEach(charge => {
        const pending = charge.aliquot;
        const applied = Math.min(commonFuel, pending);
        commonFuel = parseFloat((commonFuel - applied).toFixed(2));
        const unpaid = parseFloat((pending - applied).toFixed(2));
        if (unpaid > 0.01) {
            accumulatedDebt = parseFloat((accumulatedDebt + unpaid).toFixed(2));
        }
    });

    if (specialProjects) {
        for (const proj of specialProjects) {
            const amountPerInstallment = parseFloat((proj.total_budget / (16 * proj.installments_count)).toFixed(2));
            for (let i = 1; i <= proj.installments_count; i++) {
                const isPaid = (specialPayments || []).some(sp => sp.project_id === proj.id && sp.installment_number === i);
                if (!isPaid) {
                    accumulatedDebt = parseFloat((accumulatedDebt + amountPerInstallment).toFixed(2));
                }
            }
        }
    }

    return {
        totalBalance: accumulatedDebt,
        surplus: commonFuel,
        net: parseFloat((accumulatedDebt - commonFuel).toFixed(2))
    };
}

async function runDetailedSummary() {
    const { data: units } = await supabase.from('units').select('id, number, tower, initial_debt, owners(full_name)');
    const { data: periods } = await supabase.from('condo_periods').select('*, period_expenses(amount)');
    const { data: payments } = await supabase.from('unit_payments').select('*');
    const { data: specProjs } = await supabase.from('special_quota_projects').select('*');
    const { data: specPays } = await supabase.from('special_quota_payments').select('*');

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentSortKey = currentYear * 100 + (currentMonth + 1);

    const report = units.map(u => {
        const uPayments = payments.filter(p => p.unit_id === u.id);
        const uSpecPays = specPays.filter(p => p.unit_id === u.id);

        // Filter periods up to now (like the app does for current view)
        const uTowerPeriods = periods.filter(p => {
            if (p.tower_id !== u.tower) return false;
            const parts = p.period_name.split(' ');
            const sk = parseInt(parts[1]) * 100 + monthMap[parts[0].toUpperCase()];
            return sk <= currentSortKey;
        });

        const uTowerSpecProjs = specProjs.filter(p => p.tower_id === u.tower && p.status === 'ACTIVE');

        const ledger = buildFinancialLedger({
            initialDebtValue: u.initial_debt,
            condoPeriods: uTowerPeriods,
            specialProjects: uTowerSpecProjs,
            specialPayments: uSpecPays,
            paymentsHistory: uPayments
        });

        return {
            Unidad: u.number,
            Propietario: u.owners?.full_name || 'N/A',
            SaldoNeto: ledger.net.toFixed(2),
            Estatus: ledger.net <= 0.1 ? 'SOLVENTE' : 'DEUDA'
        };
    });

    report.sort((a, b) => a.Unidad.localeCompare(b.Unidad));
    console.log(JSON.stringify(report, null, 2));
}

runDetailedSummary();
