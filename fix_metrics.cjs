const fs = require('fs');
const path = 'D:\\Escritorio\\Antigravity\\Palma Real\\palma-real-app\\src\\pages\\Cobranzas.jsx';

let content = fs.readFileSync(path, 'utf8');

const startMarker = '    const getUnitMetrics = (unitId) => {';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.error('START NOT FOUND'); process.exit(1); }

// Find matching closing brace+semicolon
let braceCount = 0;
let endIdx = -1;
for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            // Skip the semicolon after }
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
    '        if (!u || !currentPeriod) return { predeuda: 0, mesCursoBase: 0, saldoFavor: 0, deudaTotal: 0, paidBs: 0, paidUsd: 0, remaining: 0, status: "Pendiente" };',
    '',
    '        const towerPeriods = window._towerPeriods || [];',
    '        const allAllocations = window._allAllocations || [];',
    '',
    '        const [pMonthName, pYear] = currentPeriod.period_name.split(" ");',
    '        const mIdx = monthMap[pMonthName.toUpperCase()] || 0;',
    '        const startOfMonth = new Date(parseInt(pYear), mIdx, 1);',
    '        const endOfMonth = new Date(parseInt(pYear), mIdx + 1, 0, 23, 59, 59);',
    '        const currentPeriodSortKey = parseInt(pYear) * 100 + mIdx;',
    '',
    '        const unitPaymentsList = payments.filter(p => p.unit_id === unitId);',
    '        const unitPaymentIds = unitPaymentsList.map(p => p.id);',
    '        const unitAllocations = allAllocations.filter(a => unitPaymentIds.includes(a.payment_id));',
    '',
    '        // --- Current Month Base Quota ---',
    '        const currentPeriodObj = towerPeriods.find(p => p.id === currentPeriod.id);',
    '        const mesCursoBase = currentPeriodObj ? (currentPeriodObj._unit_aliquot || 0) : 0;',
    '',
    '        // --- 1. Expected charges strictly before this month ---',
    '        const initialDebt = parseFloat(u.initial_debt || 0);',
    '        let expectedPast = initialDebt > 0 ? initialDebt : 0;',
    '        towerPeriods.forEach(p => {',
    '            const parts = p.period_name.split(" ");',
    '            const pSort = parseInt(parts[1]) * 100 + (monthMap[parts[0].toUpperCase()] || 0);',
    '            if (pSort < currentPeriodSortKey) expectedPast += (p._unit_aliquot || 0);',
    '        });',
    '        // If initial debt is a credit, subtract it from the expected',
    '        if (initialDebt < 0) expectedPast = Math.max(0, expectedPast - Math.abs(initialDebt));',
    '',
    '        // --- 2. Paid before this month ---',
    '        const pastAllocations = unitAllocations.filter(a => {',
    '            const payment = unitPaymentsList.find(p => p.id === a.payment_id);',
    '            if (!payment) return false;',
    '            return new Date(payment.payment_date) < startOfMonth;',
    '        });',
    '        const paidPast = pastAllocations.reduce((sum, a) => sum + parseFloat(a.amount_allocated || 0), 0);',
    '',
    '        const netPast = expectedPast - paidPast;',
    '        const predeuda = Math.max(0, netPast);',
    '        const saldoFavor = Math.max(0, -netPast);',
    '',
    '        // --- 3. Payments in this month ---',
    '        const monthlyAllocations = unitAllocations.filter(a => {',
    '            const payment = unitPaymentsList.find(p => p.id === a.payment_id);',
    '            if (!payment) return false;',
    '            const pDate = new Date(payment.payment_date);',
    '            return pDate >= startOfMonth && pDate <= endOfMonth;',
    '        });',
    '        const paidUsd = monthlyAllocations.reduce((sum, a) => sum + parseFloat(a.amount_allocated || 0), 0);',
    '        const paidBs = monthlyAllocations.reduce((sum, a) => {',
    '            const payment = unitPaymentsList.find(p => p.id === a.payment_id);',
    '            if (!payment || !payment.amount_usd) return sum;',
    '            const ratio = parseFloat(a.amount_allocated) / parseFloat(payment.amount_usd);',
    '            return sum + (ratio * parseFloat(payment.amount_bs || 0));',
    '        }, 0);',
    '',
    '        // --- 4. Final calculations (bounded to selected period) ---',
    '        // Acumulado = deuda anterior (predeuda) + cuota del mes - saldo a favor previo',
    '        const deudaTotal = Math.max(0, predeuda + mesCursoBase - saldoFavor);',
    '        // Saldo Pendiente = Acumulado - abonos del mes',
    '        const remaining = Math.max(0, deudaTotal - paidUsd);',
    '',
    '        return { predeuda, saldoFavor, mesCursoBase, deudaTotal, paidUsd, paidBs, remaining, status: remaining <= 0.01 ? "Solvente" : "Deudor" };',
    '    };'
].join('\n');

const newContent = content.substring(0, startIdx) + newFunc + content.substring(endIdx);
fs.writeFileSync(path, newContent, 'utf8');
console.log('Done. File size:', newContent.length, 'bytes');
