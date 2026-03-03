import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const Header = ({ title = "Resumen General" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Cerrar al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const actions = [
        { icon: 'payments', label: 'Nuevo Pago', color: 'text-emerald-500', bg: 'bg-emerald-500/10', path: '/admin/apartamentos' },
        { icon: 'receipt_long', label: 'Registrar Gasto', color: 'text-amber-500', bg: 'bg-amber-500/10', path: '/admin/pagos' },
        { icon: 'campaign', label: 'Nuevo Comunicado', color: 'text-blue-500', bg: 'bg-blue-500/10', path: '/admin/comunicados' },
        { icon: 'assignment_add', label: 'Cuota Especial', color: 'text-purple-500', bg: 'bg-purple-500/10', path: '/admin/cuotas-especiales' },
    ];

    const handleAction = (path) => {
        navigate(path);
        setIsOpen(false);
    };

    return (
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between px-10 sticky top-0 z-50">
            <div className="flex items-center gap-6">
                <button className="lg:hidden text-slate-500 hover:text-emerald-500 p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all">
                    <span className="material-icons">menu</span>
                </button>
                <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/60 dark:text-emerald-400/60">Operativo · Live</p>
                    <h2 className="text-2xl font-display-bold text-slate-800 dark:text-white tracking-tight">{title}</h2>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <ThemeToggle />

                <button className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-2xl relative transition-all group">
                    <span className="material-icons group-hover:scale-110 transition-transform">notifications</span>
                    <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm animate-pulse"></span>
                </button>

                {/* Dropdown de Acciones Rápidas */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:shadow-xl hover:shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                        <span className="material-icons text-sm">{isOpen ? 'close' : 'bolt'}</span>
                        Acción Rápida
                    </button>

                    {isOpen && (
                        <div className="absolute right-0 mt-4 w-64 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 rounded-[2rem] shadow-2xl shadow-slate-200 dark:shadow-none p-2 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 z-50 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-50 dark:border-slate-800/50">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Centro de Control</p>
                            </div>
                            <div className="py-1">
                                {actions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleAction(action.path)}
                                        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-all text-left group"
                                    >
                                        <div className={`w-10 h-10 rounded-xl ${action.bg} ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm`}>
                                            <span className="material-icons text-lg">{action.icon}</span>
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block">{action.label}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">Lanzar ahora</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
