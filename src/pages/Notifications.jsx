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
                        type: 'Informativo'
                    }
                ]);

            if (error) throw error;

            setTitle('');
            setContent('');
            setAudience('Todos');
            fetchAnnouncements();
        } catch (error) {
            console.error('Error creating announcement:', error);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-12 pb-32">
            {/* Social Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center md:text-left space-y-2">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Comunidad oficial</span>
                    <h1 className="font-display-bold text-5xl md:text-6xl gradient-text leading-tight">Palma Real Connect</h1>
                    <p className="text-slate-500 font-semibold tracking-tight text-lg italic md:not-italic">El pulso vivo de tu hogar y comunidad ✨</p>
                </div>
                <div className="flex -space-x-4 overflow-hidden p-3 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700/50">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="inline-block h-14 w-14 rounded-full border-4 border-white dark:border-slate-800 shadow-md">
                            <img className="h-full w-full object-cover rounded-full" src={`https://i.pravatar.cc/150?u=${i + 10}`} alt="user" />
                        </div>
                    ))}
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 avatar-ring text-xs font-black text-white">
                        +85
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Center Column: Feed (Social-style) */}
                <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">
                    {/* Create Post Card */}
                    <div className="social-card p-6 md:p-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-emerald-100/50 dark:border-emerald-500/10">
                        <div className="flex gap-6 mb-8">
                            <div className="h-16 w-16 rounded-[1.5rem] emerald-gradient flex items-center justify-center text-white scale-110">
                                <span className="material-icons text-3xl">shield</span>
                            </div>
                            <div className="flex-1 pt-1">
                                <h3 className="font-display-bold text-xl text-slate-900 dark:text-white leading-none mb-1">Centro de Emisión</h3>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">Canal Administrador Verificado</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="relative group">
                                <input
                                    className="w-full bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl px-8 py-5 font-display-bold text-xl text-slate-900 dark:text-white border-2 border-transparent focus:border-emerald-200 dark:focus:border-emerald-500/30 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none placeholder:text-slate-300"
                                    placeholder="Título de la publicación..."
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300">
                                    <span className="material-icons">title</span>
                                </div>
                            </div>

                            <textarea
                                className="w-full bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] px-8 py-8 font-medium text-lg text-slate-700 dark:text-slate-200 border-2 border-transparent focus:border-emerald-200 dark:focus:border-emerald-500/30 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none resize-none min-h-[180px] placeholder:text-slate-300 custom-scrollbar"
                                placeholder="Comparte noticias, eventos o recordatorios..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            ></textarea>

                            <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex gap-3 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-full">
                                    {['Todos', 'Torres Específicas'].map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setAudience(opt)}
                                            className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${audience === opt
                                                ? "bg-white text-emerald-600 shadow-md dark:bg-slate-800 dark:text-emerald-400"
                                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={handleCreateAnnouncement}
                                    disabled={creating || !title || !content}
                                    className="px-10 py-4 emerald-gradient text-white font-display-bold text-sm rounded-[1.5rem] hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-3 uppercase tracking-widest shadow-xl shadow-emerald-500/30"
                                >
                                    {creating ? 'Publicando...' : 'Lanzar Comunicado'}
                                    <span className="material-icons text-lg">rocket_launch</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Feed Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h2 className="font-display-bold text-2xl text-slate-800 dark:text-white">Muro de Actividad</h2>
                            <button className="text-pink-500 font-bold text-sm hover:underline">Ver todo</button>
                        </div>

                        {loading ? (
                            <div className="space-y-6">
                                {[1, 2].map(i => (
                                    <div key={i} className="social-card p-8 h-48 animate-pulse bg-slate-200 dark:bg-slate-800/50"></div>
                                ))}
                            </div>
                        ) : announcements.length === 0 ? (
                            <div className="social-card p-12 text-center space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-900 w-20 h-20 rounded-full mx-auto flex items-center justify-center text-slate-300">
                                    <span className="material-symbols-outlined text-4xl">feed</span>
                                </div>
                                <p className="font-display-bold text-slate-400">Aún no hay mensajes en el muro</p>
                            </div>
                        ) : (
                            announcements.map((item) => (
                                <div key={item.id} className="social-card p-8 md:p-10 space-y-8 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-all duration-700"></div>

                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex gap-6">
                                            <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 overflow-hidden shadow-inner border border-emerald-100/50 dark:border-emerald-500/10 group-hover:scale-110 transition-transform">
                                                <span className="material-icons text-2xl">notifications_active</span>
                                            </div>
                                            <div>
                                                <h4 className="font-display-bold text-2xl text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                                                    {item.title}
                                                </h4>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">VERIFICADO</span>
                                                    </div>
                                                    <span className="text-slate-300">·</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        <span className="material-icons text-xs">calendar_today</span>
                                                        {new Date(item.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[9px] font-black uppercase tracking-[0.15em] shadow-lg">
                                            Oficial
                                        </div>
                                    </div>

                                    <div className="relative z-10">
                                        <div className="flex gap-4">
                                            <div className="w-1 bg-gradient-to-b from-emerald-500 to-transparent rounded-full opacity-20 hidden md:block"></div>
                                            <p className="text-[17px] leading-[1.8] text-slate-600 dark:text-slate-300 font-medium whitespace-pre-wrap">
                                                {item.content}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t border-slate-100 dark:border-slate-800/50">
                                            <button className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all border border-transparent hover:border-emerald-100 dark:hover:border-emerald-500/20">
                                                <span className="material-icons text-xl">favorite_border</span>
                                                <span className="text-xs font-black tracking-widest">REACCIONAR</span>
                                            </button>
                                            <button className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-500/20">
                                                <span className="material-icons text-xl">forum</span>
                                                <span className="text-xs font-black tracking-widest">DISCUTIR</span>
                                            </button>
                                            <div className="ml-auto flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                <span className="material-icons text-sm text-emerald-500">groups</span>
                                                <span>AUDIENCIA: {item.audience}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column: Mini Widgets */}
                <div className="lg:col-span-4 space-y-6 order-1 lg:order-2">
                    <div className="social-card p-8 bg-slate-900 text-white border-none shadow-emerald-500/10 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-64 h-64 emerald-gradient opacity-10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:opacity-20 transition-all duration-700"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500 opacity-5 rounded-full -ml-24 -mb-24 blur-3xl"></div>

                        <h3 className="font-display-bold text-2xl mb-2 relative z-10 tracking-tight">Comunidad 360°</h3>
                        <p className="text-emerald-400/80 text-xs font-black uppercase tracking-[0.2em] mb-8 relative z-10">Métricas de impacto</p>

                        <div className="space-y-4 relative z-10">
                            {[
                                { label: 'Mensajes Hoy', value: announcements.length, icon: 'bolt', color: 'text-emerald-400' },
                                { label: 'Alcance Red', value: '94%', icon: 'hub', color: 'text-blue-400' },
                                { label: 'Engagement', value: '12.8%', icon: 'local_fire_department', color: 'text-orange-400' }
                            ].map((stat, i) => (
                                <div key={i} className="flex items-center justify-between bg-white/5 p-5 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors group/item">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${stat.color} group-hover/item:scale-110 transition-transform`}>
                                            <span className="material-icons text-xl">{stat.icon}</span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
                                    </div>
                                    <span className="font-display-bold text-xl">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="social-card p-6 md:p-8 space-y-6">
                        <h3 className="font-display-bold text-lg text-slate-800 dark:text-white">Acciones Rápidas</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Manual', color: 'bg-blue-50 text-blue-500', icon: 'auto_stories' },
                                { label: 'Plantillas', color: 'bg-violet-50 text-violet-500', icon: 'dashboard_customize' },
                                { label: 'Archivos', color: 'bg-pink-50 text-pink-500', icon: 'folder_special' },
                                { label: 'Exportar', color: 'bg-emerald-50 text-emerald-500', icon: 'ios_share' }
                            ].map((btn, i) => (
                                <button key={i} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${btn.color} group-hover:scale-110 transition-transform`}>
                                        <span className="material-icons">{btn.icon}</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{btn.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Notifications;
