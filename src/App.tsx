import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute, PublicRoute } from './components/layout/ProtectedRoute';

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
import ResultsPage from './pages/results/ResultsPage';
import AdmissionsPage from './pages/admissions/AdmissionsPage';
import SubjectsPage from './pages/subjects/SubjectsPage';
import ExaminationsPage from './pages/examinations/ExaminationsPage';
import ReportsPage from './pages/reports/ReportsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import BackupPage from './pages/backup/BackupPage';
import SettingsPage from './pages/settings/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <Routes>
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/students" element={<StudentsPage />} />
                  <Route path="/students/add" element={<StudentFormPage />} />
                  <Route path="/students/:id" element={<StudentProfilePage />} />
                  <Route path="/students/:id/edit" element={<StudentFormPage />} />
                  <Route path="/admissions" element={<AdmissionsPage />} />
                  <Route path="/classes" element={<ClassesPage />} />
                  <Route path="/teachers" element={<TeachersPage />} />
                  <Route path="/subjects" element={<SubjectsPage />} />
                  <Route path="/fees" element={<FeesPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/payments/new" element={<PaymentFormPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/examinations" element={<ExaminationsPage />} />
                  <Route path="/results" element={<ResultsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/backup" element={<BackupPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
