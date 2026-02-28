import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import OwnerLayout from './layouts/OwnerLayout';

// Lazy-loaded Admin Pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const AliquotsConfig = lazy(() => import('./pages/AliquotsConfig'));
const VirtualAssemblies = lazy(() => import('./pages/VirtualAssemblies'));
const Reports = lazy(() => import('./pages/Reports'));
const UnitDetail = lazy(() => import('./pages/UnitDetail'));
const ApartmentList = lazy(() => import('./pages/ApartmentList'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Owners = lazy(() => import('./pages/Owners'));
const SpecialQuotas = lazy(() => import('./pages/SpecialQuotas'));
const AccountStatement = lazy(() => import('./pages/AccountStatement'));
const Cobranzas = lazy(() => import('./pages/Cobranzas'));
const Settings = lazy(() => import('./pages/Settings'));
const CashBook = lazy(() => import('./pages/CashBook'));

// Lazy-loaded Owner Pages
const OwnerPortal = lazy(() => import('./pages/OwnerPortal'));
const OwnerAccountStatement = lazy(() => import('./pages/OwnerAccountStatement'));

// Lazy-loaded Auth Pages
const Login = lazy(() => import('./pages/Login'));
const PasswordRecovery = lazy(() => import('./pages/PasswordRecovery'));

// Loading Fallback UI
const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-white"></div>
    <p className="mt-4 font-mono font-bold text-slate-500 uppercase tracking-widest text-xs">Cargando Módulo...</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/recuperar-clave" element={<PasswordRecovery />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Route>

            <Route path="/admin" element={<DashboardLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="pagos" element={<Expenses />} />
              <Route path="alicuotas" element={<AliquotsConfig />} />
              <Route path="estado-de-cuenta" element={<AccountStatement />} />
              <Route path="configuracion" element={<Settings />} />
              <Route path="asambleas" element={<VirtualAssemblies />} />
              <Route path="reportes" element={<Reports />} />
              <Route path="apartamentos" element={<ApartmentList />} />
              <Route path="apartamentos/:id" element={<UnitDetail />} />
              <Route path="cuotas-especiales" element={<SpecialQuotas />} />
              <Route path="propietarios" element={<Owners />} />
              <Route path="comunicados" element={<Notifications />} />
              <Route path="cobranzas" element={<Cobranzas />} />
              <Route path="libro-caja" element={<CashBook />} />
            </Route>

            <Route path="/portal" element={<OwnerLayout />}>
              <Route index element={<OwnerPortal />} />
              <Route path="estado-de-cuenta" element={<OwnerAccountStatement />} />
              <Route path="cuenta" element={<OwnerPortal />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
