const fs = require('fs');
const path = 'D:\\Escritorio\\Antigravity\\Palma Real\\palma-real-app\\src\\pages\\Cobranzas.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Update getUnitMetrics
const oldFunctionStart = 'const getUnitMetrics = (unitId) => {';
const oldFunctionEnd = 'return { \n            predeuda, \n            saldoFavor: historicalCredit, \n            mesCursoBase, \n            deudaTotal, \n            paidUsd, \n            paidBs, \n            remaining, \n            status: remaining <= 0.01 ? "Solvente" : "Deudor" \n        };\n    };';

const newGetUnitMetrics = `const getUnitMetrics = (unitId) => {
        const u = units.find(un => un.id === unitId);
        if (!u || !currentPeriod) return { predeuda: 0, mesCursoBase: 0, deudaTotal: 0, paidBs: 0, paidUsd: 0, remaining: 0, status: "Pendiente" };

        const towerPeriods = window._towerPeriods || [];

        const [pMonthName, pYear] = currentPeriod.period_name.split(" ");
        const mIdx = monthMap[pMonthName.toUpperCase()] || 0;
        const startOfMonth = new Date(parseInt(pYear), mIdx, 1);
        const endOfMonth = new Date(parseInt(pYear), mIdx + 1, 0, 23, 59, 59);
        const currentPeriodSortKey = parseInt(pYear) * 100 + mIdx;

        const unitPaymentsList = payments.filter(p => p.unit_id === unitId);

        // --- 1. Net Historical Balance before this month starts ---
        const initialDebt = parseFloat(u.initial_debt || 0);
        let grossPast = initialDebt > 0 ? initialDebt : 0;
        const historicalCredit = initialDebt < 0 ? Math.abs(initialDebt) : 0;

        towerPeriods.forEach(p => {
            const parts = p.period_name.split(" ");
            const pSort = parseInt(parts[1]) * 100 + (monthMap[parts[0].toUpperCase()] || 0);
            if (pSort < currentPeriodSortKey) grossPast += (p._unit_aliquot || 0);
        });

        const totalPaidBeforeThisMonth = unitPaymentsList
            .filter(p => new Date(p.payment_date) < startOfMonth)
            .reduce((sum, p) => sum + parseFloat(p.amount_usd || 0), 0);
        
        // Net balance before current month
        const predeuda = grossPast - totalPaidBeforeThisMonth - historicalCredit;

        // --- 2. Current Month GROSS Charge ---
        const currentPeriodObj = towerPeriods.find(p => p.id === currentPeriod.id);
        const mesCursoBase = currentPeriodObj ? (currentPeriodObj._unit_aliquot || 0) : 0;

        // --- 3. Net Acumulado ---
        const deudaTotal = predeuda + mesCursoBase;

        // --- 4. Full Payments made WITHIN the selected month ---
        const paymentsInMonth = unitPaymentsList.filter(p => {
            const d = new Date(p.payment_date);
            return d >= startOfMonth && d <= endOfMonth;
        });
        const paidBs = paymentsInMonth.reduce((sum, p) => sum + parseFloat(p.amount_bs || 0), 0);
        const paidUsd = paymentsInMonth.reduce((sum, p) => sum + parseFloat(p.amount_usd || 0), 0);

        // --- 5. Net Final Balance ---
        const remaining = deudaTotal - paidUsd;

        return { 
            predeuda, 
            mesCursoBase, 
            deudaTotal, 
            paidUsd, 
            paidBs, 
            remaining, 
            status: remaining <= 0.01 ? "Solvente" : "Deudor" 
        };
    };`;

// 2. Update Previous Month Column (Anterior)
const oldAnteriorColumn = `<td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right bg-slate-50/20">
                                            <span className={\`text-sm font-bold font-mono \${metrics.predeuda > 0 ? "text-red-400" : "text-slate-400"}\`}>
                                                {formatNumber(metrics.predeuda || 0)} $
                                            </span>
                                        </td>`;

const newAnteriorColumn = `<td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right bg-slate-50/20">
                                            {metrics.predeuda < -0.01 ? (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                                                        + {formatNumber(Math.abs(metrics.predeuda))} $
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-sm">
                                                        Saldo a Favor
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className={\`text-sm font-bold font-mono \${metrics.predeuda > 0.01 ? "text-red-400" : "text-slate-400"}\`}>
                                                    {formatNumber(metrics.predeuda || 0)} $
                                                </span>
                                            )}
                                        </td>`;

// 3. Update Acumulado Breakdown
const oldAcumuladoColumn = `<td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right bg-slate-50/50 dark:bg-slate-800/20">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={\`text-sm font-black font-mono \${(metrics.deudaTotal || 0) > 0 ? "text-red-500" : "text-emerald-500"}\`}>
                                                    {formatNumber(metrics.deudaTotal || 0)} $
                                                </span>
                                                <span className="text-[9px] font-mono text-slate-400">
                                                    {formatNumber(metrics.predeuda)} + {formatNumber(metrics.mesCursoBase)} $
                                                </span>
                                            </div>
                                        </td>`;

const newAcumuladoColumn = `<td className="px-6 py-3 border-r border-slate-200 dark:border-slate-800 text-right bg-slate-50/50 dark:bg-slate-800/20">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={\`text-sm font-black font-mono \${(metrics.deudaTotal || 0) > 0.01 ? "text-red-500" : "text-emerald-500"}\`}>
                                                    {formatNumber(metrics.deudaTotal || 0)} $
                                                </span>
                                                <span className="text-[9px] font-mono text-slate-400">
                                                    {metrics.predeuda < 0 ? \`- \${formatNumber(Math.abs(metrics.predeuda))}\` : formatNumber(metrics.predeuda)} + {formatNumber(metrics.mesCursoBase)} $
                                                </span>
                                            </div>
                                        </td>`;

// Apply transformations
// Find getUnitMetrics with a more flexible approach because of previous edits
const funcStartIdx = content.indexOf('const getUnitMetrics = (unitId) => {');
const funcEndIdx = content.indexOf('};', content.indexOf('return {', funcStartIdx)) + 2;

if (funcStartIdx !== -1 && funcEndIdx > funcStartIdx) {
    content = content.substring(0, funcStartIdx) + newGetUnitMetrics + content.substring(funcEndIdx);
} else {
    console.error('getUnitMetrics function not found structurally');
    process.exit(1);
}

// Replace UI columns
content = content.replace(oldAnteriorColumn, newAnteriorColumn);
content = content.replace(oldAcumuladoColumn, newAcumuladoColumn);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated Cobranzas.jsx to Net Starting Balance model.');
