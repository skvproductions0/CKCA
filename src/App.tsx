import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { MainLayout } from './components/layout/MainLayout';
import { CreatorLayout } from './components/layout/CreatorLayout';
import { ProtectedRoute, CreatorRoute, PublicRoute } from './components/layout/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/students/StudentsPage';
import StudentProfilePage from './pages/students/StudentProfilePage';
import StudentFormPage from './pages/students/StudentFormPage';
import ClassesPage from './pages/classes/ClassesPage';
import TeachersPage from './pages/teachers/TeachersPage';
import FeesPage from './pages/fees/FeesPage';
import PaymentsPage from './pages/fees/PaymentsPage';
import PaymentFormPage from './pages/fees/PaymentFormPage';
import AttendancePage from './pages/attendance/AttendancePage';
import AdmissionsPage from './pages/admissions/AdmissionsPage';
import SubjectsPage from './pages/subjects/SubjectsPage';
import ExaminationsPage from './pages/examinations/ExaminationsPage';
import ResultsPage from './pages/results/ResultsPage';
import ReportsPage from './pages/reports/ReportsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import BackupPage from './pages/backup/BackupPage';
import SettingsPage from './pages/settings/SettingsPage';

// Creator Pages
import CreatorDashboardPage from './pages/creator/CreatorDashboardPage';
import CreatorSchoolsPage from './pages/creator/CreatorSchoolsPage';
import CreatorSuperAdminsPage from './pages/creator/CreatorSuperAdminsPage';
import CreatorFeaturesPage from './pages/creator/CreatorFeaturesPage';
import CreatorSessionsPage from './pages/creator/CreatorSessionsPage';
import CreatorActiveUsersPage from './pages/creator/CreatorActiveUsersPage';
import CreatorAuditPage from './pages/creator/CreatorAuditPage';
import CreatorBackupPage from './pages/creator/CreatorBackupPage';
import CreatorSettingsPage from './pages/creator/CreatorSettingsPage';

function RootRedirect() {
  const { isCreator, impersonatedSchoolId } = useAuth();
  if (isCreator && !impersonatedSchoolId) {
    return <Navigate to="/creator/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <Routes>
              {/* Public Route */}
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              {/* Creator Layer Routes */}
              <Route element={<CreatorRoute />}>
                <Route element={<CreatorLayout />}>
                  <Route path="/creator/dashboard" element={<CreatorDashboardPage />} />
                  <Route path="/creator/schools" element={<CreatorSchoolsPage />} />
                  <Route path="/creator/super-admins" element={<CreatorSuperAdminsPage />} />
                  <Route path="/creator/features" element={<CreatorFeaturesPage />} />
                  <Route path="/creator/plans" element={<CreatorFeaturesPage />} />
                  <Route path="/creator/sessions" element={<CreatorSessionsPage />} />
                  <Route path="/creator/active-users" element={<CreatorActiveUsersPage />} />
                  <Route path="/creator/audit" element={<CreatorAuditPage />} />
                  <Route path="/creator/backup" element={<CreatorBackupPage />} />
                  <Route path="/creator/settings" element={<CreatorSettingsPage />} />
                </Route>
              </Route>

              {/* School Panel Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/settings" element={<SettingsPage />} />

                  {/* Feature-guarded routes */}
                  <Route element={<ProtectedRoute featureId="students" />}>
                    <Route path="/students" element={<StudentsPage />} />
                    <Route path="/students/add" element={<StudentFormPage />} />
                    <Route path="/students/:id" element={<StudentProfilePage />} />
                    <Route path="/students/:id/edit" element={<StudentFormPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="admissions" />}>
                    <Route path="/admissions" element={<AdmissionsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="classes" />}>
                    <Route path="/classes" element={<ClassesPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="teachers" />}>
                    <Route path="/teachers" element={<TeachersPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="subjects" />}>
                    <Route path="/subjects" element={<SubjectsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="fees" />}>
                    <Route path="/fees" element={<FeesPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="payments" />}>
                    <Route path="/payments" element={<PaymentsPage />} />
                    <Route path="/payments/new" element={<PaymentFormPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="attendance" />}>
                    <Route path="/attendance" element={<AttendancePage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="examinations" />}>
                    <Route path="/examinations" element={<ExaminationsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="results" />}>
                    <Route path="/results" element={<ResultsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="reports" />}>
                    <Route path="/reports" element={<ReportsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="notifications" />}>
                    <Route path="/notifications" element={<NotificationsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute featureId="backup" />}>
                    <Route path="/backup" element={<BackupPage />} />
                  </Route>
                </Route>
              </Route>

              {/* Default redirects */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
