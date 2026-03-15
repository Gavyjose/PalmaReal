import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useOwnerData } from '../hooks/useOwnerData';
import { useAuth } from '../context/AuthContext';

const ownerLinks = [
    { icon: 'dashboard', label: 'Inicio', to: '/portal', end: true },
    { icon: 'account_balance_wallet', label: 'Estado de Cuenta', to: '/portal/estado-de-cuenta' },
    { icon: 'description', label: 'Documentos', to: '/portal/documentos' },
    { icon: 'campaign', label: 'Comunicados', to: '/portal/comunicados' },
    { icon: 'settings', label: 'Configuración', to: '/portal/configuracion' },
];

const OwnerSidebar = () => {
    const { profile, unit, loading } = useOwnerData();
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('owner-sidebar-collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('owner-sidebar-collapsed', isCollapsed);
    }, [isCollapsed]);

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden lg:flex sticky top-0 h-screen z-20 transition-all duration-300 ease-in-out`}>
            <div className="p-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-10 h-10 min-w-[40px] bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                        <span className="material-icons">house</span>
                    </div>
                    {!isCollapsed && (
                        <span className="text-slate-900 dark:text-white font-display-black text-xl uppercase tracking-wider whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                            Palma <span className="text-emerald-600">Real</span>
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
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
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive
                                ? 'bg-emerald-500/10 text-emerald-600 font-display-bold'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 font-display-medium'
                            }`
                        }
                    >
                        <span className={`material-icons text-[20px] transition-transform ${isCollapsed ? '' : 'group-hover:scale-110'}`}>{link.icon}</span>
                        {!isCollapsed && (
                            <span className="whitespace-nowrap animate-in fade-in slide-in-from-left-2 uppercase text-[11px] tracking-widest">{link.label}</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-white/5">
                <div className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-100 dark:border-white/5 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className={`w-10 h-10 min-w-[40px] rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg ${loading ? 'animate-pulse' : ''}`}>
                        <span className="material-icons">{loading ? 'sync' : 'person'}</span>
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2">
                            <p className="text-xs font-display-black truncate text-slate-900 dark:text-white uppercase tracking-tight">
                                {loading ? 'Cargando...' : profile?.full_name || 'Propietario'}
                            </p>
                            <p className="text-[10px] text-emerald-600 font-display-black uppercase tracking-widest">
                                {loading ? '...' : `U-${unit?.number} Torre ${unit?.tower}`}
                            </p>
                        </div>
                    )}
                    
                    {!isCollapsed && (
                        <button
                            onClick={handleLogout}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Cerrar Sesión"
                        >
                            <span className="material-icons text-lg">power_settings_new</span>
                        </button>
                    )}
                </div>
                {isCollapsed && (
                    <button
                        onClick={handleLogout}
                        className="w-full mt-2 flex justify-center p-2 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                        title="Cerrar Sesión"
                    >
                        <span className="material-icons text-lg">power_settings_new</span>
                    </button>
                )}
            </div>
        </aside>
    );
};
export default OwnerSidebar;
