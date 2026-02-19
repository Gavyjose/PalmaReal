import React from 'react';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { formatCurrency } from '../utils/formatters';

const PrintPreview = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    const { selectedTower, period, expenses, bcvRate, finalTotal, aliquotPerUnit, reserveFundAmount } = data;

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
                    <div id="printable-report" className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 w-full mx-auto p-[1.5cm] min-h-[29.7cm] text-slate-900 dark:text-white print:shadow-none print:border-none print:p-8 print:m-0 print:w-full print:min-h-0">

                        {/* Report Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b-2 border-primary/20 pb-8 mb-10 print:pb-4 print:mb-6 print:gap-2">
                            <div>
                                <h1 className="text-3xl font-black text-primary mb-2 uppercase tracking-tight print:text-xl print:mb-1">{BUILDING_CONFIG.fullName}</h1>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                        <span className="material-icons text-[14px]">location_on</span>
                                        {BUILDING_CONFIG.address}
                                    </p>
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                        <span className="material-icons text-[14px]">phone</span>
                                        {BUILDING_CONFIG.phone}
                                    </p>
                                    <p className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded w-fit mt-2 print:mt-1 print:px-2 print:py-0.5">RIF: J-XXXXXXXX-X</p>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="bg-primary text-white px-4 py-2 rounded-lg font-black text-xs mb-4 uppercase tracking-widest print:py-1 print:px-3 print:mb-2 print:text-[8px]">Estado de Cuenta Mensual</div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase print:text-lg">{period}</h2>
                                <p className="text-sm font-black text-primary mt-1 uppercase print:text-xs">Torre {selectedTower}</p>
                            </div>
                        </div>

                        {/* Report Subtitle */}
                        <div className="mb-8 print:mb-4">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white border-l-4 border-primary pl-4 uppercase tracking-wide print:text-sm print:pl-2">Relación de Gastos Condominiales</h3>
                        </div>

                        {/* Main Expenses Table */}
                        <table className="w-full mb-10 border-collapse print:mb-6">
                            <thead>
                                <tr className="bg-slate-800 text-white text-[10px] uppercase font-black tracking-widest print:text-[8px]">
                                    <th className="px-4 py-3 text-left w-12 print:py-1.5 print:px-2">#</th>
                                    <th className="px-4 py-3 text-left print:py-1.5 print:px-2">Concepto / Descripción del Gasto</th>
                                    <th className="px-4 py-3 text-right print:py-1.5 print:px-2">Monto (USD $)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 border-x border-b border-slate-200 dark:border-slate-800 print:text-[11px]">
                                {expenses.map((exp, idx) => (
                                    <tr key={exp.id} className="text-sm font-medium print:text-[11px]">
                                        <td className="px-4 py-3 text-slate-400 font-bold print:py-1 print:px-2 text-center">{idx + 1}</td>
                                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200 uppercase print:py-1 print:px-2">{exp.description}</td>
                                        <td className="px-4 py-3 text-right font-black print:py-1 print:px-2">$ {formatCurrency(exp.amount)}</td>
                                    </tr>
                                ))}
                                {/* Reserve Fund Row */}
                                <tr className="text-sm font-bold bg-slate-50 dark:bg-slate-800/50 italic text-slate-600 dark:text-slate-400 print:text-[11px]">
                                    <td className="px-4 py-3 print:py-1 print:px-2"></td>
                                    <td className="px-4 py-3 uppercase print:py-1 print:px-2">Provisión Fondo de Reserva Mensual</td>
                                    <td className="px-4 py-3 text-right print:py-1 print:px-2">$ {formatCurrency(reserveFundAmount)}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr className="bg-primary/5 text-primary border-2 border-primary/20">
                                    <td colSpan="2" className="px-4 py-6 text-right font-black text-base uppercase tracking-wider print:py-3 print:text-xs">Total Gastos de la Torre</td>
                                    <td className="px-4 py-6 text-right font-black text-xl print:py-3 print:text-lg">$ {formatCurrency(finalTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Calculation Summary Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 print:gap-4 print:mb-6">
                            <div className="p-6 rounded-xl border-2 border-slate-100 dark:border-slate-800 print:p-3">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 print:mb-2 print:text-[8px]">Información de Alícuotas</h4>
                                <div className="space-y-4 print:space-y-1">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 print:pb-1">
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 print:text-[10px]">Total Apartamentos:</p>
                                        <p className="font-black text-slate-900 dark:text-white print:text-[10px]">16 Unidades</p>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 print:pb-1">
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 print:text-[10px]">Factor de Alícuota:</p>
                                        <p className="font-black text-slate-900 dark:text-white print:text-[10px]">6.25% (1/16)</p>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 print:pt-1">
                                        <p className="text-sm font-black text-primary uppercase print:text-[10px]">Couta por Apartamento:</p>
                                        <p className="text-lg font-black text-primary underline decoration-2 underline-offset-4 print:text-base">$ {formatCurrency(aliquotPerUnit)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col justify-center items-center text-center print:p-3">
                                <span className="material-icons text-slate-400 text-4xl mb-3 print:text-2xl print:mb-1">payments</span>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1 print:text-[8px]">Recordatorio de Pago</h4>
                                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase print:text-[9px]">
                                    Los pagos en bolívares deben realizarse a la tasa oficial del <span className="text-primary font-black">BCV del día en que se efectúe el pago</span>.
                                </p>
                            </div>
                        </div>

                        {/* Footer Notes */}
                        <div className="mt-auto pt-10 border-t border-slate-100 dark:border-slate-800 print:pt-4">
                            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-400 uppercase leading-relaxed print:text-[8px] print:gap-2">
                                <div>
                                    <p className="mb-2 print:mb-1">NOTAS IMPORTANTES:</p>
                                    <ul className="list-disc pl-4 space-y-1 print:space-y-0.5">
                                        <li>Los pagos deben realizarse en los primeros 15 días del mes.</li>
                                        <li>Pagos en Bs. se reciben únicamente a la tasa BCV del día.</li>
                                        <li>Cualquier discrepancia notificar a la junta de condominio.</li>
                                    </ul>
                                </div>
                                <div className="text-right">
                                    <p>Documento generado digitalmente - {new Date().toLocaleDateString('es-VE')}</p>
                                    <p>Administración Palma Real v2.0</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPreview;
