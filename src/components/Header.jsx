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
        <header className="h-16 bg-white dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-50 backdrop-blur-md">
            <div className="flex items-center gap-4">
                <button className="lg:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    <span className="material-icons">menu</span>
                </button>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h2>
            </div>

            <div className="flex items-center gap-4">
                <ThemeToggle />
                <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full relative transition-colors">
                    <span className="material-icons">notifications</span>
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                </button>

                {/* Dropdown de Acciones Rápidas */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer active:scale-95"
                    >
                        <span className="material-icons text-sm">{isOpen ? 'close' : 'add'}</span>
                        Nuevo Registro
                    </button>

                    {isOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-2xl py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                            <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acceso Rápido</p>
                            </div>
                            {actions.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAction(action.path)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left group"
                                >
                                    <div className={`w-8 h-8 rounded-lg ${action.bg} ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                        <span className="material-icons text-sm">{action.icon}</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{action.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
