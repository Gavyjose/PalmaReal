import React from 'react';

const OwnerPortal = () => {
    return (
        <>
            <header className="mb-8">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                    <span>Inicio</span>
                    <span className="material-icons text-sm">chevron_right</span>
                    <span className="text-primary font-medium">Estado de Cuenta</span>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Estado de Cuenta</h1>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* Left Column: Summary & History */}
                <div className="col-span-12 xl:col-span-8 space-y-8">
                    {/* High Impact Banner */}
                    <div className="bg-primary rounded-xl p-8 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <p className="text-primary-foreground text-sm font-semibold uppercase tracking-widest opacity-80 mb-1">Deuda Total Pendiente</p>
                                <h2 className="text-5xl font-extrabold">$1,240.00</h2>
                                <div className="mt-4 flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full text-sm">
                                    <span className="material-icons text-sm">event</span>
                                    <span>Vence el 20 de Febrero, 2026</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-primary-foreground text-sm font-semibold uppercase tracking-widest opacity-80 mb-1">Mes Pendiente</p>
                                <p className="text-2xl font-bold">Febrero 2026</p>
                                <p className="text-primary-foreground/70 text-sm">Mantenimiento Ordinario</p>
                            </div>
                        </div>
                        {/* Abstract Background Detail */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-10 -mb-10"></div>
                    </div>

                    {/* History Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Historial de Pagos</h3>
                            <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
                                <span className="material-icons text-sm">file_download</span>
                                Descargar Todo
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Fecha</th>
                                        <th className="px-6 py-4">N° Recibo</th>
                                        <th className="px-6 py-4">Concepto</th>
                                        <th className="px-6 py-4">Monto</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">15 Ene, 2026</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-slate-700 dark:text-slate-300">#REC-9021</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">Mantenimiento Ene 2026</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-white">$620.00</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                Procesado
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="text-slate-400 hover:text-primary transition-colors">
                                                <span className="material-icons">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">12 Dic, 2025</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-slate-700 dark:text-slate-300">#REC-8845</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">Mantenimiento Dic 2025</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-white">$620.00</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                Procesado
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="text-slate-400 hover:text-primary transition-colors">
                                                <span className="material-icons">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 text-center">
                            <button className="text-primary font-bold text-sm hover:underline">Cargar movimientos anteriores</button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Notify Payment Form */}
                <div className="col-span-12 xl:col-span-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sticky top-8">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="material-icons text-primary">add_circle</span>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Notificar Pago</h3>
                        </div>
                        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mes a pagar</label>
                                <select className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg py-3 px-4 focus:ring-primary focus:border-primary transition-all outline-none text-slate-700 dark:text-slate-300">
                                    <option>Seleccione un mes</option>
                                    <option selected>Febrero 2026 ($620.00)</option>
                                    <option>Enero 2026 (Saldo $620.00)</option>
                                    <option>Cuota Especial Jardinería ($150.00)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Monto Transferido ($)</label>
                                <input className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg py-3 px-4 focus:ring-primary focus:border-primary transition-all outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400" placeholder="Ej. 620.00" step="0.01" type="number" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Número de Referencia</label>
                                <input className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg py-3 px-4 focus:ring-primary focus:border-primary transition-all outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400" placeholder="Ej. 1234567890" type="text" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Comprobante de Pago</label>
                                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer transition-all">
                                    <span className="material-icons text-slate-400 mb-2">cloud_upload</span>
                                    <p className="text-xs text-slate-500 font-medium">Suelte el archivo aquí o haga clic para subir</p>
                                    <p class="text-[10px] text-slate-400 mt-1">Formatos: JPG, PNG o PDF (Máx. 5MB)</p>
                                </div>
                            </div>
                            <div className="pt-4">
                                <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer" type="submit">
                                    <span className="material-icons text-sm">send</span>
                                    Enviar Notificación
                                </button>
                                <p className="text-center text-[11px] text-slate-400 mt-4 leading-relaxed">
                                    Su pago será verificado por el administrador en un plazo de 24 a 48 horas hábiles.
                                </p>
                            </div>
                        </form>
                    </div>

                    {/* Helpful Info Card */}
                    <div className="mt-6 bg-primary/5 border border-primary/10 rounded-xl p-5">
                        <div className="flex gap-3">
                            <span className="material-icons text-primary">info</span>
                            <div>
                                <p className="text-sm font-bold text-primary mb-1">Cuentas Bancarias</p>
                                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    <p>Banco Nacional: 0102-XXXX-XXXX</p>
                                    <p>Zelle: pagos@condopro.com</p>
                                    <p>Pago Móvil: 0102 J-12345678</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default OwnerPortal;
