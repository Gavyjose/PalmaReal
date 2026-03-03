/**
 * fix_metrics_v2.cjs
 * Rewrites getUnitMetrics in Cobranzas.jsx to use GROSS charges 
 * (not net of payments) so that period columns always show the original 
 * charged amount regardless of payments made.
 */
const fs = require('fs');
const path = 'D:\\Escritorio\\Antigravity\\Palma Real\\palma-real-app\\src\\pages\\Cobranzas.jsx';

let content = fs.readFileSync(path, 'utf8');

const startMarker = '    const getUnitMetrics = (unitId) => {';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.error('START NOT FOUND'); process.exit(1); }

let braceCount = 0;
let endIdx = -1;
for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            endIdx = i + 1;
            if (content[endIdx] === ';') endIdx++;
            break;
        }
    }
}
if (endIdx === -1) { console.error('END NOT FOUND'); process.exit(1); }
console.log('Replacing chars', startIdx, 'to', endIdx);

const newFunc = [
    '    const getUnitMetrics = (unitId) => {',
    '        const u = units.find(un => un.id === unitId);',
    '        if (!u || !currentPeriod) return { predeuda: 0, saldoFavor: 0, mesCursoBase: 0, deudaTotal: 0, paidBs: 0, paidUsd: 0, remaining: 0, status: "Pendiente" };',
    '',
    '        const towerPeriods = window._towerPeriods || [];',
    '        const allAllocations = window._allAllocations || [];',
    '',
    '        const [pMonthName, pYear] = currentPeriod.period_name.split(" ");',
    '        const mIdx = monthMap[pMonthName.toUpperCase()] || 0;',
    '        const endOfMonth = new Date(parseInt(pYear), mIdx + 1, 0, 23, 59, 59);',
    '        const currentPeriodSortKey = parseInt(pYear) * 100 + mIdx;',
    '',
    '        const unitPaymentsList = payments.filter(p => p.unit_id === unitId);',
    '        const unitPaymentIds = unitPaymentsList.map(p => p.id);',
    '        const unitAllocations = allAllocations.filter(a => unitPaymentIds.includes(a.payment_id));',
    '',
    '        // --- Current Month Base Quota (gross charge, always) ---',
    '        const currentPeriodObj = towerPeriods.find(p => p.id === currentPeriod.id);',
    '        const mesCursoBase = currentPeriodObj ? (currentPeriodObj._unit_aliquot || 0) : 0;',
    '',
    '        // --- 1. GROSS charges from all periods BEFORE this month ---',
    '        // This is what was BILLED in the past, not net of payments.',
    '        const initialDebt = parseFloat(u.initial_debt || 0);',
    '        let grossPastPositive = initialDebt > 0 ? initialDebt : 0;',
    '        const historicalCredit = initialDebt < 0 ? Math.abs(initialDebt) : 0;',
    '',
    '        towerPeriods.forEach(p => {',
    '            const parts = p.period_name.split(" ");',
    '            const pSort = parseInt(parts[1]) * 100 + (monthMap[parts[0].toUpperCase()] || 0);',
    '            if (pSort < currentPeriodSortKey) grossPastPositive += (p._unit_aliquot || 0);',
    '        });',
    '',
    '        // Net past amount (gross charges minus any historical credit)',
    '        const netPast = grossPastPositive - historicalCredit;',
    '        const predeuda = Math.max(0, netPast);',
    '        const saldoFavor = Math.max(0, -netPast);',
    '',
    '        // --- 2. GROSS Acumulado = gross past + current month charge ---',
    '        // Always shows the total of what was BILLED across both period columns.',
    '        const deudaTotal = predeuda + mesCursoBase;',
    '',
    '        // --- 3. ALL payments up to end of the current month being viewed ---',
    '        // Include both past and current-month allocations.',
    '        const allRelevantAllocations = unitAllocations.filter(a => {',
    '            const payment = unitPaymentsList.find(p => p.id === a.payment_id);',
    '            if (!payment) return false;',
    '            return new Date(payment.payment_date) <= endOfMonth;',
    '        });',
    '',
    '        const paidUsd = allRelevantAllocations.reduce((sum, a) => sum + parseFloat(a.amount_allocated || 0), 0);',
    '        const paidBs = allRelevantAllocations.reduce((sum, a) => {',
    '            const payment = unitPaymentsList.find(p => p.id === a.payment_id);',
    '            if (!payment || !payment.amount_usd) return sum;',
    '            const ratio = parseFloat(a.amount_allocated) / parseFloat(payment.amount_usd);',
    '            return sum + (ratio * parseFloat(payment.amount_bs || 0));',
    '        }, 0);',
    '',
    '        // --- 4. Saldo Pendiente ---',
    '        // CAN be negative = saldo a favor (they overpaid)',
    '        const remaining = deudaTotal - paidUsd;',
    '',
    '        return { predeuda, saldoFavor, mesCursoBase, deudaTotal, paidUsd, paidBs, remaining, status: remaining <= 0.01 ? "Solvente" : "Deudor" };',
    '    };'
].join('\n');

const newContent = content.substring(0, startIdx) + newFunc + content.substring(endIdx);
fs.writeFileSync(path, newContent, 'utf8');
console.log('Done. File size:', newContent.length, 'bytes');
