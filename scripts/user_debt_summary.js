import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const monthMap = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
};

async function getSummaryForUser() {
    console.log("Calculando resumen de deudas (Punto de corte: FEBRERO 2026)...");

    // 1. Fetch Basic Data
    const { data: units } = await supabase.from('units').select('id, number, tower, initial_debt, owners(full_name)');
    const { data: condoPeriods } = await supabase.from('condo_periods').select('*, period_expenses(amount)');
    const { data: paymentsHistory } = await supabase.from('unit_payments').select('*');
    const { data: specialPayments } = await supabase.from('special_quota_payments').select('*');

    // Target Period: FEBRERO 2026
    const targetMonth = 1; // Feb
    const targetYear = 2026;
    const targetSortKey = targetYear * 100 + targetMonth;
    const endOfTargetMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const report = units.filter(u => u.tower === 'A9').map(u => {
        const uId = u.id;

        // --- PRE-DEBT (Saldo Antes de Febrero) ---
        const periodsBefore = condoPeriods.filter(p => {
            if (p.tower_id !== u.tower) return false;
            const pts = p.period_name.split(" ");
            const sk = parseInt(pts[1]) * 100 + monthMap[pts[0].toUpperCase()];
            return sk < targetSortKey;
        });

        const paymentsBefore = paymentsHistory.filter(p => p.unit_id === uId && new Date(p.payment_date) < new Date(2026, 1, 1));
        const specBefore = specialPayments.filter(p => p.unit_id === uId && p.payment_date && new Date(p.payment_date) < new Date(2026, 1, 1));

        const getLedger = (periods, payments, specials) => {
            let debt = parseFloat(u.initial_debt || 0);
            let fuel = payments.reduce((s, p) => s + parseFloat(p.amount_usd), 0) - specials.reduce((s, p) => s + parseFloat(p.amount), 0);

            // Sort periods
            const sorted = periods.sort((a, b) => {
                const ptsA = a.period_name.split(' ');
                const skA = parseInt(ptsA[1]) * 100 + monthMap[ptsA[0].toUpperCase()];
                const ptsB = b.period_name.split(' ');
                const skB = parseInt(ptsB[1]) * 100 + monthMap[ptsB[0].toUpperCase()];
                return skA - skB;
            });

            sorted.forEach(p => {
                const expTotal = (p.period_expenses || []).reduce((s, e) => s + parseFloat(e.amount), 0);
                const aliq = p.unit_aliquot_usd || ((expTotal + parseFloat(p.reserve_fund || 0)) / 16);
                debt += aliq;
            });

            return debt - fuel;
        };

        const saldoAntVal = getLedger(periodsBefore, paymentsBefore, specBefore);

        // --- CURRENT MONTH (Febrero) ---
        const febPeriod = condoPeriods.find(p => p.tower_id === u.tower && p.period_name.toUpperCase() === 'FEBRERO 2026');
        const expFeb = febPeriod ? (febPeriod.period_expenses || []).reduce((s, e) => s + parseFloat(e.amount), 0) : 0;
        const aliqFeb = febPeriod ? (febPeriod.unit_aliquot_usd || ((expFeb + parseFloat(febPeriod.reserve_fund || 0)) / 16)) : 0;

        const paymentsInFeb = paymentsHistory.filter(p => p.unit_id === uId && new Date(p.payment_date) >= new Date(2026, 1, 1) && new Date(p.payment_date) <= endOfTargetMonth);
        const paidFeb = paymentsInFeb.reduce((s, p) => s + parseFloat(p.amount_usd), 0);

        const totalRemaining = parseFloat((saldoAntVal + aliqFeb - paidFeb).toFixed(2));

        return {
            "Apartamento": u.number,
            "Residente": u.owners?.full_name || 'N/A',
            "Saldo Anterior ($)": saldoAntVal.toFixed(2),
            "Mes Curso ($)": aliqFeb.toFixed(2),
            "Pagado Feb ($)": paidFeb.toFixed(2),
            "Saldo Final ($)": totalRemaining.toFixed(2),
            "Situación": totalRemaining <= 0.1 ? "SOLVENTE" : "DEUDOR"
        };
    });

    report.sort((a, b) => a.Apartamento.localeCompare(b.Apartamento));
    console.table(report);
}

getSummaryForUser();
