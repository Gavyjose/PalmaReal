import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import ChangePasswordModal from '../components/auth/ChangePasswordModal';

const DashboardLayout = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { mustChangePassword, loading: permissionsLoading } = usePermissions();

    // Mapeo de rutas a títulos
    const getTitle = (path) => {
        if (path === '/admin') return 'Dashboard Principal';
        if (path.includes('apartamentos')) return 'Directorio de Apartamentos';
        if (path.includes('pagos')) return 'Gestión de Pagos';
        if (path.includes('estado-de-cuenta')) return 'Conciliación Bancaria';
        if (path.includes('reportes')) return 'Reportes Financieros';
        if (path.includes('comunicados')) return 'Comunicados';
        if (path.includes('asambleas')) return 'Asambleas Virtuales';
        if (path.includes('alicuotas')) return 'Configuración de Alícuotas';
        if (path.includes('cuotas-especiales')) return 'Cuotas Especiales';
        if (path.includes('propietarios')) return 'Directorio de Propietarios';
        if (path.includes('configuracion')) return 'Configuración del Sistema';
        return 'Resumen General';
    };

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-display text-slate-800 dark:text-slate-100 selection:bg-emerald-500/30">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
                <Header title={getTitle(location.pathname)} />
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Outlet />
                    </div>
                </div>
            </main>

            <ChangePasswordModal
                isOpen={mustChangePassword}
                userEmail={user?.email}
            />
        </div>
    );
};
export default DashboardLayout;
