import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthLayout from './layouts/AuthLayout';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import AdminDashboard from './pages/AdminDashboard';
import Expenses from './pages/Expenses';
import AliquotsConfig from './pages/AliquotsConfig';
import VirtualAssemblies from './pages/VirtualAssemblies';
import Reports from './pages/Reports';
import UnitDetail from './pages/UnitDetail';
import ApartmentList from './pages/ApartmentList';
import Notifications from './pages/Notifications';
import Owners from './pages/Owners';
import SpecialQuotas from './pages/SpecialQuotas';
import OwnerLayout from './layouts/OwnerLayout';
import OwnerPortal from './pages/OwnerPortal';
import Settings from './pages/Settings';
import OwnerAccountStatement from './pages/OwnerAccountStatement';
import AccountStatement from './pages/AccountStatement';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
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
            {/* Other admin routes */}
          </Route>

          <Route path="/portal" element={<OwnerLayout />}>
            <Route index element={<OwnerPortal />} />
            <Route path="estado-de-cuenta" element={<OwnerAccountStatement />} />
            <Route path="cuenta" element={<OwnerPortal />} />
            {/* Other owner routes */}
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
