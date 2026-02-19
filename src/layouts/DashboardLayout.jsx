import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const DashboardLayout = () => {
    const location = useLocation();

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
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-800 dark:text-slate-100">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
                <Header title={getTitle(location.pathname)} />
                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
export default DashboardLayout;
