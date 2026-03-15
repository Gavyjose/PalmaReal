import React from 'react';
import { createPortal } from 'react-dom';
import { BUILDING_CONFIG } from '../config/buildingConfig';
import { formatCurrency } from '../utils/formatters';

const CobranzasReport = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    const { units, totals, selectedTower, towerId } = data;
    const today = new Date().toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const handlePrint = () => {
        window.print();
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md print:bg-white print:p-0 print:static print:block print-container">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:max-h-none print:rounded-none print:shadow-none print:w-full print:h-auto print:overflow-visible">
                {/* Header / Actions - Hidden on print */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            <span className="material-icons">description</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Reporte Oficial de Cobranzas</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Vista previa del documento impreso</p>
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
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
                        >
                            <span className="material-icons text-sm">print</span>
                            Imprimir Reporte
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950/50 print:p-0 print:bg-white print:overflow-visible">
                    <div id="printable-report" className="bg-white shadow-sm border border-slate-200 w-full mx-auto p-[1cm] min-h-[27.94cm] text-slate-900 print:shadow-none print:border-none print:p-8 print:m-0 print:w-full print:min-h-0">

                        {/* Institutional Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b-2 border-emerald-600 pb-6 mb-8 print:pb-4 print:mb-6 print:gap-2">
                            <div>
                                <h1 className="text-2xl font-black text-emerald-700 mb-1 uppercase tracking-tight print:text-xl">{BUILDING_CONFIG.fullName}</h1>
                                <p className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase">
                                    <span className="material-icons text-[12px]">location_on</span>
                                    {BUILDING_CONFIG.address}
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="bg-emerald-600 text-white px-3 py-1 rounded font-black text-[10px] mb-2 uppercase tracking-widest print:py-0.5 print:px-2 print:text-[8px]">
                                    Libro de Cobranzas Mensual
                                </div>
                                <h2 className="text-xl font-black text-slate-800 uppercase print:text-lg">Torre: {selectedTower}</h2>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Fecha de Emisión: {today}</p>
                            </div>
                        </div>

                        {/* Summary Indicators */}
                        <div className="grid grid-cols-4 gap-4 mb-8 print:mb-6">
                            <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Unidades</p>
                                <p className="text-lg font-black text-slate-800">{units.length}</p>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-lg bg-emerald-50/30">
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mb-1">Deuda Anterior</p>
                                <p className="text-lg font-black text-emerald-700">$ {formatCurrency(totals.due)}</p>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-lg bg-amber-50/30">
                                <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider mb-1">Cuota Mes</p>
                                <p className="text-lg font-black text-amber-700">$ {formatCurrency(totals.month)}</p>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-lg bg-slate-900">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Total a Cobrar</p>
                                <p className="text-lg font-black text-white">$ {formatCurrency(totals.total)}</p>
                            </div>
                        </div>

                        {/* Main Table */}
                        <table className="w-full border-collapse border border-slate-300">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 text-[9px] uppercase font-black tracking-widest border-b border-slate-300">
                                    <th className="px-2 py-2 text-left border-r border-slate-300 w-12">Unidad</th>
                                    <th className="px-3 py-2 text-left border-r border-slate-300">Propietario / Responsable</th>
                                    <th className="px-3 py-2 text-right border-r border-slate-300 w-24">Deuda Ant.</th>
                                    <th className="px-3 py-2 text-right border-r border-slate-300 w-24">Cuota Mes</th>
                                    <th className="px-3 py-2 text-right bg-slate-200 w-28 text-slate-900 border-r border-slate-300">Total Deuda</th>
                                    <th className="px-3 py-2 text-right w-24">Pagado</th>
                                    <th className="px-3 py-2 text-right w-24 bg-red-50 text-red-700">Saldo Pend.</th>
                                </tr>
                            </thead>
                            <tbody className="text-[10px] font-medium">
                                {units.map((unit) => (
                                    <tr key={unit.id} className="border-b border-slate-200 hover:bg-slate-50">
                                        <td className="px-2 py-2 border-r border-slate-200 font-black text-center">{unit.unit_name}</td>
                                        <td className="px-3 py-2 border-r border-slate-200 uppercase truncate max-w-[150px]">
                                            {unit.owner_name || 'Sin asignar'}
                                        </td>
                                        <td className="px-3 py-2 text-right border-r border-slate-200">$ {formatCurrency(unit.previous_debt || 0)}</td>
                                        <td className="px-3 py-2 text-right border-r border-slate-200">$ {formatCurrency(unit.month_quota || 0)}</td>
                                        <td className="px-3 py-2 text-right font-black border-r border-slate-200 bg-slate-50">$ {formatCurrency(unit.total_debt || 0)}</td>
                                        <td className="px-3 py-2 text-right border-r border-slate-200 text-emerald-600 font-bold">$ {formatCurrency(unit.total_paid || 0)}</td>
                                        <td className={`px-3 py-2 text-right font-black border-r border-slate-200 ${unit.balance <= 0.01 ? 'bg-emerald-50/50 text-emerald-700' : 'bg-red-50/50 text-red-700'}`}>
                                            $ {formatCurrency(unit.balance || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-900 text-white text-[11px] font-black uppercase">
                                <tr>
                                    <td colSpan="2" className="px-4 py-3 text-right tracking-wider">TOTALES GENERALES</td>
                                    <td className="px-3 py-3 text-right">$ {formatCurrency(totals.due)}</td>
                                    <td className="px-3 py-3 text-right">$ {formatCurrency(totals.month)}</td>
                                    <td className="px-3 py-3 text-right bg-emerald-600">$ {formatCurrency(totals.total)}</td>
                                    <td className="px-3 py-3 text-right text-emerald-300">$ {formatCurrency(totals.paid)}</td>
                                    <td className={`px-3 py-3 text-right ${totals.balance <= 0.01 ? 'bg-emerald-600' : 'bg-red-800'}`}>$ {formatCurrency(totals.balance)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Footer / Signatures */}
                        <div className="mt-16 pt-8 border-t border-slate-100">
                            <div className="grid grid-cols-2 gap-12 text-center">
                                <div className="flex flex-col items-center">
                                    <div className="w-48 border-b border-slate-400 mb-2"></div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Administración / Tesorería</p>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="w-48 border-b border-slate-400 mb-2"></div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Revisado Junta de Condominio</p>
                                </div>
                            </div>
                            <div className="mt-12 flex justify-between items-end text-[8px] font-bold text-slate-400 uppercase italic">
                                <div>
                                    <p>Este documento es una relación detallada de cobranzas para uso interno y de los propietarios.</p>
                                    <p>Palma Real Digital v2.4 - Report System</p>
                                </div>
                                <div className="text-right">
                                    <p>Página 1 de 1</p>
                                    <p>Generado por: {BUILDING_CONFIG.name} Admin</p>
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
                        size: letter portrait;
                    }
                    
                    /* Bloqueo total de la UI de la aplicación */
                    html, body, #root, [data-reactroot] {
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    body > *:not(.print-container) {
                        display: none !important;
                        position: fixed !important;
                        top: -9999px !important;
                    }

                    #root {
                        display: none !important;
                    }

                    .print-container {
                        display: block !important;
                        position: relative !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        z-index: 99999 !important;
                    }

                    #printable-report {
                        display: block !important;
                        width: 21cm !important;
                        min-height: 29.7cm !important;
                        margin: 0 auto !important;
                        padding: 1.5cm !important;
                        border: none !important;
                        box-shadow: none !important;
                        page-break-after: avoid !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    table { 
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: auto !important;
                    }
                    
                    tr { page-break-inside: avoid !important; page-break-after: auto !important; }
                    thead { display: table-header-group !important; }
                    tfoot { display: table-footer-group !important; }
                }
            ` }} />
        </div>,
        document.body
    );
};

export default CobranzasReport;
