// src/utils/financialUtils.js

const monthMap = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
    'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
};

/**
 * Builds a chronological financial ledger for a unit.
 * 
 * @param {Object} params
 * @param {number|string} params.initialDebtValue - The unit's initial_debt from Supabase
 * @param {Array} params.condoPeriods - Array of condo_periods with period_expenses
 * @param {Array} params.specialProjects - Array of special_quota_projects for this tower
 * @param {Array} params.specialPayments - Array of special_quota_payments for this unit
 * @param {Object} params.paymentsMap - Map of { [period_id]: amount_paid_total }
 * @param {Array} params.paymentsHistory - Array of raw unit_payments (optional)
 * @returns {Object} { history, accumulatedDebt, remainingInitialDebt, rawCharges, latestAliquot }
 */
export const buildFinancialLedger = ({
    initialDebtValue,
    condoPeriods,
    specialProjects,
    specialPayments,
    paymentsHistory = []
}) => {
    let accumulatedDebt = 0;
    let history = [];
    let latestAliquot = 0;
    let rawCharges = [];

    // 1. Sort Condo Periods Oldest First
    let sortedPeriods = [...(condoPeriods || [])].sort((a, b) => {
        const partsA = a.period_name.split(' ');
        const partsB = b.period_name.split(' ');
        const yearA = parseInt(partsA[1]) || 0;
        const yearB = parseInt(partsB[1]) || 0;
        const monthA = monthMap[partsA[0].toUpperCase()] || 0;
        const monthB = monthMap[partsB[0].toUpperCase()] || 0;
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
    });

    // 2. Calculate the "Common Pool" (Fuel)
    const totalPayments = (paymentsHistory || []).reduce((sum, p) => sum + parseFloat(p.amount_usd || 0), 0);
    const reservedForSpecial = (specialPayments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const parsedInitialDebt = parseFloat(initialDebtValue || 0);
    const startingCredit = parsedInitialDebt < 0 ? Math.abs(parsedInitialDebt) : 0;

    // The "Fuel" is everything paid minus what's reserved for special quotas + any starting credit
    let commonFuel = totalPayments - reservedForSpecial + startingCredit;

    // 3. Define Charges (Chronological Order)
    // a. Initial Debt (As a starting point)
    if (parsedInitialDebt > 0) {
        rawCharges.push({
            id: 'INITIAL_DEBT',
            period_name: 'SALDO ANTERIOR',
            total_expenses: 0,
            aliquot: parsedInitialDebt,
            original_aliquot: parsedInitialDebt,
            paid_amount: 0,
            status: 'DEUDA',
            type: 'HISTORY',
            sortKey: 0
        });
    }

    // b. Condo Periods (All of them, no shifting)
    let processedPeriods = [...sortedPeriods];
    processedPeriods.forEach((period, index) => {
        const parts = period.period_name.split(' ');
        const year = parseInt(parts[1]) || 0;
        const month = monthMap[parts[0].toUpperCase()] || 0;
        const periodSortKey = year * 100 + month;

        const expensesList = period.period_expenses || [];
        const totalExpenses = parseFloat(expensesList.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0).toFixed(2));
        const finalTotal = parseFloat((totalExpenses + parseFloat(period.reserve_fund || 0)).toFixed(2));

        // Prioritize persisted aliquot from unified database
        const aliquot = period.unit_aliquot_usd
            ? parseFloat(period.unit_aliquot_usd)
            : parseFloat((finalTotal / 16).toFixed(2));

        rawCharges.push({
            id: period.id,
            period_name: period.period_name,
            total_expenses: finalTotal,
            aliquot: aliquot,
            original_aliquot: aliquot,
            paid_amount: 0,
            status: 'DEUDA',
            type: 'CONDO',
            sortKey: periodSortKey
        });

        // Always keep track of the latest aliquot for display
        if (index === processedPeriods.length - 1) {
            latestAliquot = aliquot;
        }
    });

    // Handle latestAliquot fallback if we consumed the only period
    if (processedPeriods.length === 0 && rawCharges.length > 0) {
        latestAliquot = rawCharges[rawCharges.length - 1].original_aliquot;
    }

    // 4. Apply Common Fuel to General Charges
    rawCharges.sort((a, b) => a.sortKey - b.sortKey);
    rawCharges.forEach(charge => {
        const pending = charge.original_aliquot;
        if (commonFuel > 0) {
            const applied = Math.min(commonFuel, pending);
            charge.paid_amount = parseFloat(applied.toFixed(2));
            commonFuel = parseFloat((commonFuel - applied).toFixed(2));

            if (charge.paid_amount >= pending - 0.05) {
                charge.status = 'PAGADO';
            }
        }

        if (charge.status !== 'PAGADO') {
            accumulatedDebt = parseFloat((accumulatedDebt + (charge.original_aliquot - charge.paid_amount)).toFixed(2));
        }
    });

    // 5. Apply Special Quotas (STRICT Mode: Only if record exists)
    if (specialProjects && specialProjects.length > 0) {
        for (const proj of specialProjects) {
            const amountPerInstallment = parseFloat((proj.total_budget / (16 * proj.installments_count)).toFixed(2));
            for (let i = 1; i <= proj.installments_count; i++) {
                // Find explicit payment record for THIS installment
                const p = (specialPayments || []).find(sp => sp.project_id === proj.id && sp.installment_number === i);
                const isPaid = !!p;

                const charge = {
                    id: `${proj.id}-${i}`,
                    project_id: proj.id,
                    period_name: `${proj.name} - CUOTA ${i}`,
                    total_expenses: 0,
                    aliquot: amountPerInstallment,
                    original_aliquot: amountPerInstallment,
                    paid_amount: isPaid ? amountPerInstallment : 0,
                    status: isPaid ? 'PAGADO' : 'DEUDA',
                    type: 'SPECIAL',
                    installment_number: i,
                    sortKey: 999900 + i
                };

                rawCharges.push(charge);
                if (!isPaid) {
                    accumulatedDebt = parseFloat((accumulatedDebt + amountPerInstallment).toFixed(2));
                }
            }
        }
    }

    // 6. Build Final History for UI
    if (commonFuel > 0) {
        history.push({
            id: 'SURPLUS_CREDIT',
            period_name: 'SALDO A FAVOR (EXCEDENTE)',
            total_expenses: 0,
            aliquot: commonFuel,
            original_aliquot: commonFuel,
            paid_amount: 0,
            status: 'A FAVOR',
            type: 'HISTORY_CREDIT',
            sortKey: -1
        });
    }

    const historyDebt = rawCharges.find(c => c.type === 'HISTORY');
    if (historyDebt) history.push(historyDebt);

    const condoCharges = rawCharges.filter(c => c.type === 'CONDO').sort((a, b) => b.sortKey - a.sortKey);
    history.push(...condoCharges);

    const specialCharges = rawCharges.filter(c => c.type === 'SPECIAL').sort((a, b) => a.sortKey - b.sortKey);
    history.push(...specialCharges);

    return {
        latestAliquot,
        totalBalance: accumulatedDebt,
        remainingInitialDebt: commonFuel, // This acts as the net surplus
        latestPeriodName: sortedPeriods.length > 0 ? sortedPeriods[sortedPeriods.length - 1].period_name : 'N/A',
        lastPayment: paymentsHistory && paymentsHistory.length > 0 ? paymentsHistory[0].amount_usd : 0,
        lastPaymentDate: paymentsHistory && paymentsHistory.length > 0 ? paymentsHistory[0].payment_date : null,
        history,
        payments: paymentsHistory,
        rawCharges
    };
};
