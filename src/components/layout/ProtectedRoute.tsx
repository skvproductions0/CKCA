import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/ui/Common';
import { hasPermission } from '../../utils/helpers';

interface ProtectedRouteProps {
  permission?: string;
}

export function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingSpinner message="Checking authentication..." />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (permission && user && !hasPermission(user.role, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
