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
const SolvencyCertificate = lazy(() => import('./pages/SolvencyCertificate'));

// Lazy-loaded Auth Pages
const Login = lazy(() => import('./pages/Login'));
const PasswordRecovery = lazy(() => import('./pages/PasswordRecovery'));

import { useAuth } from './context/AuthContext';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, role, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // If user is logged in but doesn't have the role, redirect based on their actual role
    if (role === 'PROPIETARIO') {
      return <Navigate to="/portal" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  return children;
};

// Loading Fallback UI
const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div className="w-16 h-16 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin dark:border-slate-800 dark:border-t-emerald-400"></div>
    <p className="mt-4 font-mono font-bold text-slate-500 uppercase tracking-widest text-[10px]">Sincronizando Live Connect...</p>
  </div>
);

function App() {
  console.log('App: Rendering components...');
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

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['MASTER', 'OPERADOR', 'VISOR']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
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

            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={['MASTER', 'OPERADOR', 'VISOR', 'PROPIETARIO']}>
                  <OwnerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OwnerPortal />} />
              <Route path="estado-de-cuenta" element={<OwnerAccountStatement />} />
              <Route path="documentos" element={<OwnerPortal />} />
              <Route path="comunicados" element={<OwnerPortal />} />
              <Route path="configuracion" element={<OwnerPortal />} />
              <Route path="cuenta" element={<OwnerPortal />} />
            </Route>

            {/* Print Route (No Layout) */}
            <Route
              path="/constancia/:unitId"
              element={
                <ProtectedRoute allowedRoles={['MASTER', 'OPERADOR', 'VISOR', 'PROPIETARIO']}>
                  <SolvencyCertificate />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
