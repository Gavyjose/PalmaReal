const fs = require('fs');
const path = 'D:\\Escritorio\\Antigravity\\Palma Real\\palma-real-app\\src\\pages\\Cobranzas.jsx';

let content = fs.readFileSync(path, 'utf8');

// Find the marker after which we insert the missing logic
const afterMarker = 'window._specialPayments = specialPayments || [];';
const afterIdx = content.indexOf(afterMarker);
if (afterIdx === -1) { console.error('Marker 1 NOT FOUND'); process.exit(1); }

// Find where the JSX starts
const jsxMarker = '{/* Header */ }';
const jsxIdx = content.indexOf(jsxMarker);
if (jsxIdx === -1) { console.error('Marker 2 NOT FOUND'); process.exit(1); }

// Preparation of the replacement block
const middleBlock = `
        } catch (error) {
            console.error('Error fetching collection data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getUnitMetrics = (unitId) => {
        const u = units.find(un => un.id === unitId);
        if (!u || !currentPeriod) return { predeuda: 0, saldoFavor: 0, mesCursoBase: 0, deudaTotal: 0, paidBs: 0, paidUsd: 0, remaining: 0, status: "Pendiente" };

        const towerPeriods = window._towerPeriods || [];

        const [pMonthName, pYear] = currentPeriod.period_name.split(" ");
        const mIdx = monthMap[pMonthName.toUpperCase()] || 0;
        const startOfMonth = new Date(parseInt(pYear), mIdx, 1);
        const endOfMonth = new Date(parseInt(pYear), mIdx + 1, 0, 23, 59, 59);
        const currentPeriodSortKey = parseInt(pYear) * 100 + mIdx;

        const unitPaymentsList = payments.filter(p => p.unit_id === unitId);

        // --- 1. Gross Charges ---
        const currentPeriodObj = towerPeriods.find(p => p.id === currentPeriod.id);
        const mesCursoBase = currentPeriodObj ? (currentPeriodObj._unit_aliquot || 0) : 0;

        const initialDebt = parseFloat(u.initial_debt || 0);
        let grossPast = initialDebt > 0 ? initialDebt : 0;
        const historicalCredit = initialDebt < 0 ? Math.abs(initialDebt) : 0;

        towerPeriods.forEach(p => {
            const parts = p.period_name.split(" ");
            const pSort = parseInt(parts[1]) * 100 + (monthMap[parts[0].toUpperCase()] || 0);
            if (pSort < currentPeriodSortKey) grossPast += (p._unit_aliquot || 0);
        });

        const predeuda = grossPast;
        const deudaTotal = predeuda + mesCursoBase;

        // --- 2. Full Payments made IN the selected month ---
        const paymentsInMonth = unitPaymentsList.filter(p => {
            const d = new Date(p.payment_date);
            return d >= startOfMonth && d <= endOfMonth;
        });
        const paidBs = paymentsInMonth.reduce((sum, p) => sum + parseFloat(p.amount_bs || 0), 0);
        const paidUsd = paymentsInMonth.reduce((sum, p) => sum + parseFloat(p.amount_usd || 0), 0);

        // --- 3. Net Balance (Remaining) ---
        const totalBilledPastAndCurrent = grossPast + mesCursoBase;
        const totalPaidToDate = unitPaymentsList
            .filter(p => new Date(p.payment_date) <= endOfMonth)
            .reduce((sum, p) => sum + parseFloat(p.amount_usd || 0), 0);
        
        const remaining = totalBilledPastAndCurrent - totalPaidToDate - historicalCredit;

        return { 
            predeuda, 
            saldoFavor: historicalCredit, 
            mesCursoBase, 
            deudaTotal, 
            paidUsd, 
            paidBs, 
            remaining, 
            status: remaining <= 0.01 ? "Solvente" : "Deudor" 
        };
    };

    const getMonthTotals = () => {
        if (!currentPeriod) return { bs: 0, usd: 0 };
        const [month, year] = currentPeriod.period_name.split(' ');
        const mIdx = monthMap[month.toUpperCase()] || 0;
        const start = new Date(year, mIdx, 1);
        const end = new Date(year, mIdx + 1, 0, 23, 59, 59);

        const monthlyPayments = payments.filter(p => {
            const d = new Date(p.payment_date);
            return d >= start && d <= end;
        });

        const totalUsd = monthlyPayments.reduce((sum, p) => sum + parseFloat(p.amount_usd || 0), 0);
        const totalBs = monthlyPayments.reduce((sum, p) => sum + parseFloat(p.amount_bs || 0), 0);

        return { bs: totalBs, usd: totalUsd };
    };

    const { bs: totalCollectedBs, usd: totalCollectedUsd } = getMonthTotals();

    return (
        <div className="flex flex-col flex-1 max-w-[1600px] mx-auto w-full p-4 lg:p-8 gap-6 min-h-screen animate-fade-in text-slate-800 dark:text-slate-100">
`;

// Combine the pieces
const newContent = content.substring(0, afterIdx + afterMarker.length) + middleBlock + content.substring(jsxIdx);
fs.writeFileSync(path, newContent, 'utf8');
console.log('Successfully repaired Cobranzas.jsx structure.');
