import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import { MasterLayout, SuperadminLayout, AdminLayout, OperatorLayout, OfficerLayout } from './components/layout/index.jsx';
import MasterDashboard from './pages/master/MasterDashboard';
import ManageSuperadmin from './pages/master/ManageSuperadmin';
import ManageAdmins from './pages/master/ManageAdmins';
import ManageRanks from './pages/master/ManageRanks';
import BulkUploadOfficers from './pages/master/BulkUploadOfficers';
import MasterOfficers from './pages/master/MasterOfficers';
import SuperadminDashboard from './pages/superadmin/SuperadminDashboard';
import SuperadminAdmins from './pages/superadmin/SuperadminAdmins';
import SuperadminDuties from './pages/superadmin/SuperadminDuties';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOperators from './pages/admin/AdminOperators';
import AdminDuties from './pages/admin/AdminDuties';
import OperatorDashboard from './pages/operator/OperatorDashboard';
import ManageOfficers from './pages/operator/ManageOfficers';
import ManageDuties from './pages/operator/ManageDuties';
import CreateDuty from './pages/operator/CreateDuty';
import DutyDetail from './pages/operator/DutyDetail';
import OfficerDashboard from './pages/officer/OfficerDashboard';
import OfficerDuties from './pages/officer/OfficerDuties';
import OfficerHistory from './pages/officer/OfficerHistory';
import SettingsPage from './pages/shared/SettingsPage';
import NotFoundPage from './pages/shared/NotFoundPage';
import NotificationsPage from './pages/shared/NotificationsPage';
import LoadingSpinner from './components/common/LoadingSpinner';

const ROLE_PATHS = {
  master: '/master', superadmin: '/superadmin', admin: '/admin',
  operator_special: '/operator', operator_regular: '/operator', officer: '/officer',
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={ROLE_PATHS[user.role] || '/login'} replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (user) return <Navigate to={ROLE_PATHS[user.role] || '/login'} replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

      <Route path="/master" element={<ProtectedRoute allowedRoles={['master']}><MasterLayout /></ProtectedRoute>}>
        <Route index element={<MasterDashboard />} />
        <Route path="superadmin" element={<ManageSuperadmin />} />
        <Route path="admins" element={<ManageAdmins />} />
        <Route path="ranks" element={<ManageRanks />} />
        <Route path="officers/bulk-upload" element={<BulkUploadOfficers />} />
        <Route path="officers" element={<MasterOfficers />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/superadmin" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminLayout /></ProtectedRoute>}>
        <Route index element={<SuperadminDashboard />} />
        <Route path="admins" element={<SuperadminAdmins />} />
        <Route path="duties" element={<SuperadminDuties />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="operators" element={<AdminOperators />} />
        <Route path="duties" element={<AdminDuties />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/operator" element={<ProtectedRoute allowedRoles={['operator_special', 'operator_regular']}><OperatorLayout /></ProtectedRoute>}>
        <Route index element={<OperatorDashboard />} />
        <Route path="officers" element={<ManageOfficers />} />
        <Route path="duties" element={<ManageDuties />} />
        <Route path="duties/create" element={<CreateDuty />} />
        <Route path="duties/:dutyId" element={<DutyDetail />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="/officer" element={<ProtectedRoute allowedRoles={['officer']}><OfficerLayout /></ProtectedRoute>}>
        <Route index element={<OfficerDashboard />} />
        <Route path="duties" element={<OfficerDuties />} />
        <Route path="history" element={<OfficerHistory />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
