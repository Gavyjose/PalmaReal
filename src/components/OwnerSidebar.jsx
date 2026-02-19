import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const ownerLinks = [
    { icon: 'dashboard', label: 'Inicio', to: '/portal', end: true },
    { icon: 'account_balance_wallet', label: 'Estado de Cuenta', to: '/portal/estado-de-cuenta' },
    { icon: 'description', label: 'Documentos', to: '/portal/documentos' },
    { icon: 'campaign', label: 'Comunicados', to: '/portal/comunicados' },
    { icon: 'settings', label: 'Configuración', to: '/portal/configuracion' },
];

const OwnerSidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('owner-sidebar-collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('owner-sidebar-collapsed', isCollapsed);
    }, [isCollapsed]);

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden lg:flex sticky top-0 h-screen z-20 transition-all duration-300 ease-in-out`}>
            <div className="p-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-10 h-10 min-w-[40px] bg-primary rounded-lg flex items-center justify-center text-white">
                        <span className="material-icons">domain</span>
                    </div>
                    {!isCollapsed && (
                        <span className="text-primary font-bold text-xl uppercase tracking-wider whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                            CondoPro
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary transition-colors cursor-pointer"
                >
                    <span className="material-icons text-sm">{isCollapsed ? 'menu_open' : 'menu'}</span>
                </button>
            </div>

            <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                {ownerLinks.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        title={isCollapsed ? link.label : ""}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group ${isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                            }`
                        }
                    >
                        <span className="material-icons text-[20px] group-hover:scale-110 transition-transform">{link.icon}</span>
                        {!isCollapsed && (
                            <span className="whitespace-nowrap animate-in fade-in slide-in-from-left-2">{link.label}</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden">
                    <div className="w-10 h-10 min-w-[40px] rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <span className="material-icons">person</span>
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden animate-in fade-in slide-in-from-left-2">
                            <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">Carlos Pérez</p>
                            <p className="text-xs text-slate-500 truncate">Apto. 12-B Torre A</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};
export default OwnerSidebar;
