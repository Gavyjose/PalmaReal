import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Notifications = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [audience, setAudience] = useState('Todos');

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAnnouncements(data || []);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAnnouncement = async () => {
        if (!title.trim() || !content.trim()) return;

        try {
            setCreating(true);
            const { error } = await supabase
                .from('announcements')
                .insert([
                    {
                        title,
                        content,
                        audience,
                        type: 'Informativo' // Default for now
                    }
                ]);

            if (error) throw error;

            // Reset form and refresh list
            setTitle('');
            setContent('');
            setAudience('Todos');
            fetchAnnouncements();
        } catch (error) {
            console.error('Error creating announcement:', error);
            alert('Error al crear el anuncio');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="max-w-[1440px] mx-auto p-6 space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Centro de Notificaciones</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona y envía comunicados oficiales a los residentes de las torres.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                        <span className="material-icons text-sm">file_download</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reporte Mensual</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Composer */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="material-icons text-primary">edit_note</span>
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Redactar Nuevo Anuncio</h3>
                            </div>
                            <span className="text-[10px] font-bold py-1 px-2 rounded bg-primary/10 text-primary uppercase tracking-widest">Borrador Autoguardado</span>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Recipients Selector */}
                            <div>
                                <label className="block text-sm font-bold mb-3 text-slate-700 dark:text-slate-300 uppercase tracking-wider">Destinatarios</label>
                                <div className="flex gap-4">
                                    <label className="flex-1 cursor-pointer group">
                                        <input
                                            checked={audience === 'Todos'}
                                            onChange={() => setAudience('Todos')}
                                            className="hidden peer"
                                            name="audience"
                                            type="radio"
                                        />
                                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 peer-checked:border-primary peer-checked:bg-primary/5 transition-all group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 peer-checked:text-primary">
                                                    <span className="material-icons">groups</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">Todos</p>
                                                    <p className="text-xs text-slate-500">420 Residentes</p>
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                    <label className="flex-1 cursor-pointer group">
                                        <input
                                            checked={audience === 'Torres Específicas'}
                                            onChange={() => setAudience('Torres Específicas')}
                                            className="hidden peer"
                                            name="audience"
                                            type="radio"
                                        />
                                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 peer-checked:border-primary peer-checked:bg-primary/5 transition-all group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 peer-checked:text-primary">
                                                    <span className="material-icons">apartment</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">Torres Específicas</p>
                                                    <p className="text-xs text-slate-500">Selección manual</p>
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            {/* Subject */}
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300 uppercase tracking-wider">Asunto del Comunicado</label>
                                <input
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-white outline-none"
                                    placeholder="Ej: Mantenimiento programado de ascensores"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value.toUpperCase())}
                                />
                            </div>
                            {/* Editor */}
                            <div>
                                <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300 uppercase tracking-wider">Contenido del Mensaje</label>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 p-2 flex gap-1">
                                        <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-300"><span className="material-icons text-sm">format_bold</span></button>
                                        <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-300"><span className="material-icons text-sm">format_italic</span></button>
                                        <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-300"><span className="material-icons text-sm">format_list_bulleted</span></button>
                                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                                        <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-300"><span className="material-icons text-sm">link</span></button>
                                        <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-600 dark:text-slate-300"><span className="material-icons text-sm">image</span></button>
                                    </div>
                                    <textarea
                                        className="w-full bg-transparent border-none focus:ring-0 p-4 resize-none text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                                        placeholder="Escriba aquí los detalles del anuncio..."
                                        rows="8"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value.toUpperCase())}
                                    ></textarea>
                                </div>
                            </div>
                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 gap-4">
                                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                                    <button className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer">
                                        <span className="material-icons text-lg">attach_file</span>
                                        Adjuntar Archivo
                                    </button>
                                    <button className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer">
                                        <span className="material-icons text-lg">schedule</span>
                                        Programar
                                    </button>
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <button className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer">Vista Previa</button>
                                    <button
                                        onClick={handleCreateAnnouncement}
                                        disabled={creating || !title || !content}
                                        className="flex-1 sm:flex-none px-8 py-2.5 rounded-lg font-bold text-sm bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-icons text-sm">send</span>
                                        {creating ? 'Publicando...' : 'Publicar Anuncio'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Template quick access */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-full">
                                <span className="material-icons text-primary">auto_awesome</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">¿Necesitas ayuda?</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Usa nuestras plantillas predefinidas para cortes de agua, asambleas o eventos.</p>
                            </div>
                        </div>
                        <button className="text-primary text-sm font-bold hover:underline cursor-pointer">Ver Plantillas</button>
                    </div>
                </div>

                {/* Right Column: History & Metrics */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-[820px] shadow-sm">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Historial de Anuncios</h3>
                                <button className="text-slate-400 hover:text-primary transition-colors cursor-pointer">
                                    <span className="material-icons">filter_list</span>
                                </button>
                            </div>
                            <div className="relative">
                                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary focus:border-primary" placeholder="Buscar por asunto o fecha..." type="text" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {loading ? (
                                <p className="text-center text-slate-400 mt-10">Cargando anuncios...</p>
                            ) : announcements.length === 0 ? (
                                <p className="text-center text-slate-400 mt-10">No hay anuncios publicados aún.</p>
                            ) : (
                                announcements.map((item) => (
                                    <div key={item.id} className="group p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-primary/50 transition-all cursor-pointer">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </span>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Enviado</span>
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-sm mb-1 text-slate-900 dark:text-white group-hover:text-primary transition-colors">{item.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{item.content}</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1">
                                                    <span className="material-icons text-slate-400 text-sm">visibility</span>
                                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">0%</span>
                                                </div>
                                            </div>
                                            <span className="material-icons text-slate-300 group-hover:text-primary">chevron_right</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-center">
                            <button className="text-sm font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer">Cargar más anuncios</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Notifications;
