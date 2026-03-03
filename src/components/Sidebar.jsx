import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

const sidebarLinks = [
    { icon: 'dashboard', label: 'Dashboard', to: '/admin', end: true, key: 'dashboard' },
    { icon: 'apartment', label: 'Apartamentos', to: '/admin/apartamentos', key: 'apartamentos' },
    { icon: 'payments', label: 'Pagos y Recibos', to: '/admin/pagos', key: 'pagos' },
    { icon: 'account_balance', label: 'Estado de Cuenta', to: '/admin/estado-de-cuenta', key: 'estado_cuenta' },
    { icon: 'receipt_long', label: 'Libro de Cobranzas', to: '/admin/cobranzas', key: 'cobranzas' },
    { icon: 'account_balance_wallet', label: 'Libro de Caja', to: '/admin/libro-caja', key: 'libro_caja' },
    { icon: 'assessment', label: 'Reportes', to: '/admin/reportes', key: 'reportes' },
    { icon: 'campaign', label: 'Comunicados', to: '/admin/comunicados', key: 'comunicados' },
    { icon: 'how_to_vote', label: 'Asambleas', to: '/admin/asambleas', key: 'asambleas' },
    { icon: 'pie_chart', label: 'Alícuotas', to: '/admin/alicuotas', key: 'alicuotas' },
    { icon: 'assignment', label: 'Cuotas Especiales', to: '/admin/cuotas-especiales', key: 'cuotas_especiales' },
    { icon: 'people', label: 'Propietarios', to: '/admin/propietarios', key: 'propietarios' },
    { icon: 'settings', label: 'Configuración', to: '/admin/configuracion', key: 'configuracion' },
];

const Sidebar = () => {
    const { user, signOut } = useAuth();
    const { hasPermission, isMaster, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    }, [isCollapsed]);

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Filtrar links basados en permisos
    const filteredLinks = sidebarLinks.filter(link => {
        if (isMaster) return true;
        // Dashboard siempre visible
        if (link.key === 'dashboard') return true;
        // Configuración solo para MASTER
        if (link.key === 'configuracion') return false;

        return hasPermission(link.key, 'can_view');
    });

    return (
        <aside className={`${isCollapsed ? 'w-24' : 'w-72'} bg-slate-50/40 dark:bg-slate-950/40 backdrop-blur-2xl hidden lg:flex flex-col sticky top-0 h-screen z-20 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] border-r border-white/20 dark:border-slate-800/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
            {/* Brand Logo Section */}
            <div className="p-8 flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-12 h-12 min-w-[48px] bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 transform hover:scale-105 hover:rotate-3 transition-all duration-300">
                        <span className="material-icons text-2xl font-bold">vibrant_content</span>
                    </div>
                    {!isCollapsed && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                            <h1 className="font-display-bold text-xl tracking-tight leading-none text-slate-900 dark:text-white">
                                Palma<span className="text-emerald-500">Real</span>
                            </h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600/60 dark:text-emerald-400/60 mt-1.5">Live Connect</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2.5 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl text-slate-400 hover:text-emerald-500 shadow-sm hover:shadow-md backdrop-blur-md transition-all duration-300 border border-transparent hover:border-emerald-500/20"
                >
                    <span className="material-icons text-lg">{isCollapsed ? 'chevron_right' : 'chevron_left'}</span>
                </button>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar scroll-smooth">
                {filteredLinks.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        title={isCollapsed ? link.label : ""}
                        className={({ isActive }) =>
                            `flex items-center gap-4 px-4 py-3.5 text-sm font-bold rounded-[1.75rem] transition-all duration-300 group relative overflow-hidden ${isActive
                                ? 'bg-gradient-to-r from-emerald-500/10 to-transparent text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <span className={`material-icons transition-all duration-300 relative z-10 ${isActive
                                    ? 'scale-110 text-emerald-500 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                    : 'group-hover:scale-110 group-hover:text-emerald-500'}`}>
                                    {link.icon}
                                </span>
                                {!isCollapsed && (
                                    <span className="whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300 relative z-10">{link.label}</span>
                                )}

                                {isActive && (
                                    <>
                                        <div className="absolute left-0 w-1.5 h-7 bg-emerald-500 rounded-r-full shadow-[2px_0_12px_rgba(16,185,129,0.4)] animate-in slide-in-from-left-full duration-500"></div>
                                        <div className="absolute inset-0 bg-emerald-500/5 dark:bg-emerald-500/10 backdrop-blur-sm animate-in fade-in duration-700"></div>
                                    </>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* User Profile Section */}
            <div className="p-6">
                <div className={`social-card bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-3.5 flex items-center gap-4 group cursor-pointer border border-white/40 dark:border-slate-800/40 shadow-xl shadow-slate-200/20 dark:shadow-none transition-all duration-300 hover:bg-white/60 dark:hover:bg-slate-800/60 ${isCollapsed ? 'justify-center overflow-hidden rounded-[2rem]' : 'rounded-[2.5rem]'}`}>
                    <div className="relative">
                        <img
                            alt="Admin"
                            className="w-12 h-12 min-w-[48px] rounded-2xl object-cover ring-2 ring-emerald-500/10 group-hover:ring-emerald-500/40 group-hover:scale-105 transition-all duration-500"
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'admin'}&backgroundColor=b6e3f4,c0aede,d1d4f9`}
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full shadow-lg shadow-emerald-500/40 animate-pulse"></div>
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-4 duration-500">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 mb-0.5">
                                {permissionsLoading ? 'Cargando...' : (isMaster ? 'Master Global' : 'Gestor Live')}
                            </p>
                            <p className="text-sm font-display-bold truncate text-slate-800 dark:text-white" title={user?.email}>
                                {user?.email?.split('@')[0] || 'Admin'}
                            </p>
                        </div>
                    )}

                    {!isCollapsed && (
                        <button
                            onClick={handleLogout}
                            className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all duration-300 group/logout"
                            title="Desconectar"
                        >
                            <span className="material-icons text-xl group-hover/logout:rotate-12 transition-transform">power_settings_new</span>
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
