import React from 'react';

const VirtualAssemblies = () => {
    return (
        <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col md:flex-row gap-6 p-6">
            {/* Left Sidebar: Voting List */}
            <aside className="w-full md:w-1/4 flex flex-col gap-4 border-r border-slate-200 dark:border-slate-800 pr-4 md:pr-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Votaciones</h2>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">4 Activas</span>
                </div>
                <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
                    <input className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-500" placeholder="Buscar asamblea..." type="text" />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
                    {/* Active Voting Item */}
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 cursor-pointer transition-all hover:bg-primary/20">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-primary px-2 py-0.5 bg-primary/20 rounded">Activa</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Hoy, 10:00 AM</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1 text-slate-800 dark:text-white">Presupuesto Fachada 2026</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">Aprobación del presupuesto extraordinario para la pintura exterior de las torres A y B.</p>
                    </div>
                    {/* Active Voting Item 2 */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-primary px-2 py-0.5 bg-primary/20 rounded">Activa</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Hace 2 horas</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1 text-slate-800 dark:text-white">Cambio de Administración</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">Ratificación del contrato con la nueva empresa de seguridad y limpieza.</p>
                    </div>
                    {/* Closed Voting Item */}
                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/10 border border-slate-200 dark:border-slate-700/30 opacity-60 cursor-pointer grayscale hover:grayscale-0 transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 px-2 py-0.5 bg-slate-200 dark:bg-slate-700/30 rounded">Cerrada</span>
                            <span className="text-[10px] text-slate-500">15 Oct 2023</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1 text-slate-600 dark:text-slate-300">Remodelación de Piscina</h3>
                        <p className="text-xs text-slate-500 line-clamp-2">Votación final para la elección de materiales del área social.</p>
                    </div>
                    {/* Active Voting Item 3 */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-primary px-2 py-0.5 bg-primary/20 rounded">Activa</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Ayer</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1 text-slate-800 dark:text-white">Reglamento de Mascotas</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">Modificación al artículo 24 sobre el uso de zonas comunes por caninos.</p>
                    </div>
                </div>
            </aside>

            {/* Main Content: Voting Detail & Results */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                {/* Voting Detail Card */}
                <section className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h2 className="text-3xl font-extrabold mb-2 text-slate-900 dark:text-white">¿Aprobar presupuesto para pintura de fachada?</h2>
                            <p className="text-slate-600 dark:text-slate-400 max-w-2xl">La asamblea propone un presupuesto de $45,000,000 COP para el mantenimiento preventivo y pintura de las fachadas norte y sur. Incluye impermeabilización de ventanales.</p>
                        </div>
                        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-center min-w-[180px]">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary mb-1">Cierre en</p>
                            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono flex justify-center gap-1">
                                <span>14</span><span className="text-primary animate-pulse">:</span><span>02</span><span class="text-primary animate-pulse">:</span><span>55</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Interaction Area */}
                        <div>
                            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Emite tu voto</h4>
                            <div className="space-y-3 mb-6">
                                <label className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-primary/50 transition-colors group">
                                    <input className="w-5 h-5 text-primary bg-transparent border-slate-400 dark:border-slate-600 focus:ring-primary focus:ring-offset-slate-900" name="vote" type="radio" />
                                    <span className="text-lg font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">Sí, apruebo el presupuesto</span>
                                </label>
                                <label className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-red-500/50 transition-colors group">
                                    <input className="w-5 h-5 text-primary bg-transparent border-slate-400 dark:border-slate-600 focus:ring-primary focus:ring-offset-slate-900" name="vote" type="radio" />
                                    <span className="text-lg font-semibold text-slate-700 dark:text-slate-200 group-hover:text-red-400 transition-colors">No, rechazo el presupuesto</span>
                                </label>
                                <label className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-slate-400 transition-colors group">
                                    <input className="w-5 h-5 text-primary bg-transparent border-slate-400 dark:border-slate-600 focus:ring-primary focus:ring-offset-slate-900" name="vote" type="radio" />
                                    <span className="text-lg font-semibold text-slate-700 dark:text-slate-200 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">Abstención</span>
                                </label>
                            </div>
                            <button className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer">
                                <span className="material-icons text-xl">check_circle</span>
                                Confirmar Mi Voto
                            </button>
                        </div>
                        {/* Live Stats Area */}
                        <div className="flex flex-col">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Resultados en Tiempo Real</h4>
                            <div className="bg-slate-100 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700/50 flex-1 flex flex-col justify-center">
                                <div className="mb-6">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Participación</span>
                                        <span className="text-2xl font-black text-primary">65%</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: '65%' }}></div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">156 de 240 unidades han votado</p>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-300">
                                            <span>Sí</span>
                                            <span className="font-bold">72%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500" style={{ width: '72%' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-300">
                                            <span>No</span>
                                            <span className="font-bold">18%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500" style={{ width: '18%' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-300">
                                            <span>Abstención</span>
                                            <span className="font-bold">10%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-500" style={{ width: '10%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Debate Section */}
                <section className="bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700/50 rounded-xl p-8 mb-6">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="material-icons text-primary">forum</span>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Comentarios y Debates</h3>
                    </div>
                    <div className="space-y-6">
                        {/* Comment Input */}
                        <div className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                <span className="material-icons">person</span>
                            </div>
                            <div className="flex-1">
                                <textarea className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-500" placeholder="Escribe tu opinión sobre esta votación..." rows="2"></textarea>
                                <div className="flex justify-end mt-2">
                                    <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-sm font-bold transition-colors cursor-pointer">Publicar</button>
                                </div>
                            </div>
                        </div>
                        {/* Comment Thread */}
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">EM</div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm text-slate-800 dark:text-white">Elena Martínez</span>
                                        <span className="text-[10px] text-slate-500">• Apto 201</span>
                                        <span className="text-[10px] text-slate-500">• Hace 45 min</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">Considero que el presupuesto es elevado. ¿Se han pedido otras cotizaciones aparte de la empresa sugerida? Sería ideal ver al menos 3 opciones.</p>
                                    <div className="flex gap-4 mt-2">
                                        <button className="text-xs text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer">Responder</button>
                                        <button className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"><span className="material-icons text-sm">thumb_up</span> 12</button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">RD</div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm text-slate-800 dark:text-white">Roberto Díaz</span>
                                        <span className="text-[10px] text-slate-500">• Apto 505</span>
                                        <span className="text-[10px] text-slate-500">• Hace 2 horas</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">De acuerdo con Elena, pero también es cierto que la humedad está afectando los apartamentos del último piso. Necesitamos actuar rápido antes de la temporada de lluvias.</p>
                                    <div className="flex gap-4 mt-2">
                                        <button className="text-xs text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer">Responder</button>
                                        <button className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"><span className="material-icons text-sm">thumb_up</span> 8</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default VirtualAssemblies;
