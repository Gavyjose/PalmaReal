import React from 'react';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { supabase } from '../supabase';

const PrintPreview = ({ isOpen, onClose, data, type = 'alicuotas' }) => {
    const [settings, setSettings] = React.useState({
        header_fullname: BUILDING_CONFIG.fullName,
        header_address: BUILDING_CONFIG.address,
        bank_name: '',
        account_number: '',
        account_holder: '',
        pm_bank_code: '',
        pm_id: '',
        pm_phone: '',
        tower_name_prefix: 'Torre Araguaney'
    });

    React.useEffect(() => {
        const fetchSettings = async () => {
            const { data: sData } = await supabase.from('building_settings').select('*').limit(1).maybeSingle();
            if (sData) setSettings(sData);
        };
        if (isOpen) fetchSettings();
    }, [isOpen]);

    if (!isOpen || !data) return null;

    const { selectedTower, period, expenses, finalTotal, aliquotPerUnit, reserveFundAmount } = data;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:bg-transparent print:p-0">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:max-h-none print:rounded-none print:shadow-none print:w-full print:h-auto print:overflow-visible">
                {/* Header / Actions */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-icons">visibility</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Vista Previa de Reporte</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Presione Imprimir para generar el PDF</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-bold transition-all"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={handlePrint}
                            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all"
                        >
                            <span className="material-icons text-sm">print</span>
                            Imprimir / PDF
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950/50 print:p-0 print:bg-white print:overflow-visible">
                    <div id="printable-report" className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 w-full mx-auto p-[1cm] min-h-[27.94cm] text-slate-900 dark:text-white print:shadow-none print:border-none print:p-8 print:m-0 print:w-full print:min-h-0">

                        {/* Report Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b-2 border-primary/20 pb-4 mb-6 print:pb-2 print:mb-4 print:gap-2">
                            <div className="flex-1">
                                <h1 className="text-2xl font-black text-primary mb-1 uppercase tracking-tight print:text-lg print:mb-0">{settings.header_fullname}</h1>
                                <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase">
                                    <span className="material-icons text-[12px]">location_on</span>
                                    {settings.header_address}
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="bg-primary text-white px-3 py-1 rounded font-black text-[9px] mb-2 uppercase tracking-widest print:py-0.5 print:px-2 print:mb-1 print:text-[7px]">Estado de Cuenta Mensual</div>
                                <div className="flex items-center justify-between w-full gap-8 print:gap-4 mt-2 print:mt-1">
                                    <h2 className="text-lg font-black text-slate-600 dark:text-slate-400 uppercase print:text-sm">{settings.tower_name_prefix} {selectedTower.replace(/\D/g, '')}</h2>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase print:text-base">{period}</h2>
                                </div>
                            </div>
                        </div>

                        {/* Report Subtitle */}
                        <div className="mb-8 print:mb-4">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white border-l-4 border-primary pl-4 uppercase tracking-wide print:text-sm print:pl-2">
                                {type === 'alicuotas' ? 'Relación de Gastos Condominiales' : 'Relación de Gastos Reales (Ejecutados)'}
                            </h3>
                        </div>

                        {/* Main Expenses Table */}
                        <table className="w-full mb-10 border-collapse print:mb-6">
                            <thead>
                                <tr className="bg-slate-800 text-white text-[10px] uppercase font-black tracking-widest print:text-[8px]">
                                    <th className="px-4 py-3 text-left w-12 print:py-1.5 print:px-2">#</th>
                                    <th className="px-4 py-3 text-left print:py-1.5 print:px-2">Concepto / Descripción del Gasto</th>
                                    <th className="px-4 py-3 text-right w-24 print:py-1.5 print:px-2">{type === 'alicuotas' ? 'Monto Total' : 'Estm. ($)'}</th>
                                    {type === 'gastos_reales' && (
                                        <>
                                            <th className="px-4 py-3 text-right w-24 print:py-1.5 print:px-2 text-emerald-300">Pago (Bs)</th>
                                            <th className="px-4 py-3 text-right w-24 print:py-1.5 print:px-2 text-emerald-300">Ejec. ($)</th>
                                            <th className="px-4 py-3 text-right w-24 print:py-1.5 print:px-2 bg-slate-700">Dif. ($)</th>
                                        </>
                                    )}
                                    {type === 'alicuotas' && (
                                        <th className="px-4 py-3 text-right w-24 bg-emerald-700 print:py-1.5 print:px-2">Alícuota (USD)</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 border-x border-b border-slate-200 dark:border-slate-800 print:text-[11px]">
                                {expenses.map((exp, idx) => {
                                    const estimated = parseFloat(exp.amount) || 0;
                                    const paid = parseFloat(exp.amount_usd_at_payment) || 0;
                                    const diff = estimated - paid;
                                    return (
                                        <tr key={exp.id} className="text-sm font-medium print:text-[11px]">
                                            <td className="px-4 py-3 text-slate-400 font-bold print:py-1 print:px-2 text-center">{idx + 1}</td>
                                            <td className="px-4 py-3 text-slate-800 dark:text-slate-200 uppercase print:py-1 print:px-2">{exp.description}</td>
                                            <td className="px-4 py-3 text-right font-black print:py-1 print:px-2">$ {formatCurrency(estimated)}</td>
                                            {type === 'gastos_reales' && (
                                                <>
                                                    <td className="px-4 py-3 text-right print:py-1 print:px-2">{exp.amount_bs ? `Bs. ${formatNumber(exp.amount_bs)}` : '--'}</td>
                                                    <td className="px-4 py-3 text-right font-black text-emerald-600 print:py-1 print:px-2">
                                                        {paid > 0 ? `$ ${formatCurrency(paid)}` : '--'}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-black print:py-1 print:px-2 ${diff > 0.001 ? 'text-emerald-600' : diff < -0.001 ? 'text-rose-600' : 'text-slate-400 opacity-50'}`}>
                                                        {Math.abs(diff) > 0.001 ? `$ ${formatCurrency(diff)}` : '--'}
                                                    </td>
                                                </>
                                            )}
                                            {type === 'alicuotas' && (
                                                <td className="px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10 print:py-1 print:px-2">$ {formatCurrency(estimated / 16)}</td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {/* Reserve Fund Row */}
                                <tr className="text-sm font-bold bg-slate-50 dark:bg-slate-800/50 italic text-slate-600 dark:text-slate-400 print:text-[11px]">
                                    <td className="px-4 py-3 print:py-1 print:px-2"></td>
                                    <td className="px-4 py-3 uppercase print:py-1 print:px-2">Provisión Fondo de Reserva Mensual</td>
                                    <td className="px-4 py-3 text-right print:py-1 print:px-2">$ {formatCurrency(reserveFundAmount)}</td>
                                    <td className="px-4 py-3 text-right print:py-1 print:px-2">$ {formatCurrency(reserveFundAmount / 16)}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr className="bg-primary/5 text-primary border-2 border-primary/20">
                                    <td colSpan="2" className="px-4 py-4 text-right font-black text-[9px] uppercase tracking-wider print:py-2">TOTALES</td>
                                    <td className="px-4 py-4 text-right font-black text-lg print:py-2 print:text-base">$ {formatCurrency(finalTotal)}</td>
                                    {type === 'gastos_reales' && (
                                        <>
                                            <td className="px-4 py-4 text-right text-xs print:text-[10px]">--</td>
                                            <td className="px-4 py-4 text-right font-black text-lg text-emerald-600 print:text-base">$ {formatCurrency(data.totalPaidUsd || 0)}</td>
                                            <td className={`px-4 py-4 text-right font-black text-lg print:text-base ${(finalTotal - (data.totalPaidUsd || 0)) > 0 ? 'bg-emerald-500 text-white' : (finalTotal - (data.totalPaidUsd || 0)) < 0 ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
                                                $ {formatCurrency(finalTotal - (data.totalPaidUsd || 0))}
                                            </td>
                                        </>
                                    )}
                                    {type === 'alicuotas' && (
                                        <td className="px-4 py-4 text-right font-black text-lg bg-emerald-500 text-white print:py-2 print:text-base">$ {formatCurrency(aliquotPerUnit)}</td>
                                    )}
                                </tr>
                            </tfoot>
                        </table>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 print:grid-cols-2 print:gap-2 print:mb-4">
                            <div className="p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 print:p-3 print:border-slate-300 print:border-2 print:bg-white">
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 print:text-slate-900">Información de Alícuotas</h4>
                                <div className="space-y-2 print:space-y-1">
                                    <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-slate-800 print:pb-0.5">
                                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 print:text-[8px]">Total Apartamentos:</p>
                                        <p className="font-black text-slate-900 dark:text-white print:text-[9px]">16 Unidades</p>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 print:pt-0.5">
                                        <p className="text-[9px] font-black text-primary uppercase print:text-primary">Cuota por Apartamento:</p>
                                        <p className="text-base font-black text-primary underline decoration-2 underline-offset-4 print:text-sm">$ {formatCurrency(aliquotPerUnit)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 print:p-3 print:bg-white print:border-slate-400 print:border-2 print:flex-1">
                                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 print:text-slate-900 flex items-center gap-2">
                                    <span className="material-icons text-sm print:hidden">payments</span> Datos para el Pago
                                </h4>
                                <div className="space-y-1 text-left">
                                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase print:text-[8px]">
                                        <span className="opacity-50">Banco:</span> {settings.bank_name || 'N/A'}
                                    </p>
                                    <p className="text-[11px] font-black text-slate-900 dark:text-white print:text-[9px]">
                                        <span className="opacity-50 font-bold">Cuenta:</span> {settings.account_number || 'N/A'}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase print:text-[7px]">
                                        <span className="opacity-50">Titular:</span> {settings.account_holder || 'N/A'}
                                    </p>
                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 border-dashed">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-1 print:text-[8px]">Pago Móvil:</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase print:text-[7px]">
                                                <span className="opacity-50">Banco (Cod):</span> {settings.pm_bank_code || 'N/A'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase print:text-[7px]">
                                                <span className="opacity-50">Cédula:</span> {settings.pm_id || 'N/A'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase col-span-2 print:text-[7px]">
                                                <span className="opacity-50">Celular:</span> {settings.pm_phone || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        margin: 0.5cm;
                        size: letter;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-report, #printable-report * {
                        visibility: visible !important;
                    }
                    #printable-report {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 1.5cm !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            ` }} />
        </div>
    );
};

export default PrintPreview;
