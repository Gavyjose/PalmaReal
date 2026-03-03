import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const sidebarLinks = [
    { icon: 'dashboard', label: 'Dashboard', to: '/admin', end: true },
    { icon: 'apartment', label: 'Apartamentos', to: '/admin/apartamentos' },
    { icon: 'payments', label: 'Pagos y Recibos', to: '/admin/pagos' },
    { icon: 'account_balance', label: 'Estado de Cuenta', to: '/admin/estado-de-cuenta' },
    { icon: 'receipt_long', label: 'Libro de Cobranzas', to: '/admin/cobranzas' },
    { icon: 'account_balance_wallet', label: 'Libro de Caja', to: '/admin/libro-caja' },
    { icon: 'assessment', label: 'Reportes', to: '/admin/reportes' },
    { icon: 'campaign', label: 'Comunicados', to: '/admin/comunicados' },
    { icon: 'how_to_vote', label: 'Asambleas', to: '/admin/asambleas' },
    { icon: 'pie_chart', label: 'Alícuotas', to: '/admin/alicuotas' },
    { icon: 'assignment', label: 'Cuotas Especiales', to: '/admin/cuotas-especiales' },
    { icon: 'people', label: 'Propietarios', to: '/admin/propietarios' },
    { icon: 'settings', label: 'Configuración', to: '/admin/configuracion' },
];

const Sidebar = () => {
    const { user, signOut } = useAuth();
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

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:flex flex-col sticky top-0 h-screen z-20 transition-all duration-300 ease-in-out`}>
            <div className="p-6 flex items-center justify-between gap-3 border-b border-transparent">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 min-w-[32px] bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900">
                        <span className="material-icons text-sm">account_balance_wallet</span>
                    </div>
                    {!isCollapsed && (
                        <h1 className="font-bold text-lg tracking-tight leading-tight text-slate-800 dark:text-white whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                            CondoControl<br /><span className="text-primary text-xs font-medium uppercase tracking-widest">Administración</span>
                        </h1>
                    )}
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary transition-colors cursor-pointer"
                >
                    <span className="material-icons text-sm">{isCollapsed ? 'menu_open' : 'menu'}</span>
                </button>
            </div>

            <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
                {sidebarLinks.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        title={isCollapsed ? link.label : ""}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2 text-sm transition-all group ${isActive
                                ? 'bg-slate-100 text-slate-900 font-bold border-l-4 border-slate-900 dark:bg-slate-800 dark:text-white dark:border-white'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-transparent'
                            }`
                        }
                    >
                        <span className="material-icons group-hover:scale-110 transition-transform">{link.icon}</span>
                        {!isCollapsed && (
                            <span className="whitespace-nowrap animate-in fade-in slide-in-from-left-2">{link.label}</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 p-2 overflow-hidden">
                    <img
                        alt="Admin"
                        className="w-10 h-10 min-w-[40px] rounded-full object-cover"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDk63zNql7elUkTKTFiHSQXHgSrlLd4rx1d_G4V7-C0FkmTtbjOQ1pLmnSnlTxH-wBiCDTKCGsME_2DMWayzi_czZ7coXiUEED_uKQIpObs9bEkplsbqmsu9ZqfzKr4N3BJl5zw1AOG1FEM3wvVMsvJN_gsabC9a0tpDQyeHjFZXtfredjjNBi8TuGfM439T6iWYqQ5r_plKT5y2LQcLrVN-R5Yv4FCfLscN7cagXa8vLtziCyamRPOhodXOz62x_AEUNHgcbplwdtN"
                    />
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2">
                            <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">Admin Condominio</p>
                            <p className="text-xs text-slate-400 truncate" title={user?.email}>{user?.email || 'Buscando usuario...'}</p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className={`p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer ${isCollapsed ? 'mx-auto' : ''}`}
                        title="Cerrar Sesión"
                    >
                        <span className="material-icons text-sm">logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};
export default Sidebar;
