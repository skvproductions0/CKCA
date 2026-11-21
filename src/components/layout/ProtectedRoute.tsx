import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/ui/Common';
import { hasPermission } from '../../utils/helpers';

interface ProtectedRouteProps {
  permission?: string;
  featureId?: string;
}

export function ProtectedRoute({ permission, featureId }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, isCreator, impersonatedSchoolId } = useAuth();
  const { isFeatureEnabled } = useApp();

  if (isLoading) return <LoadingSpinner message="Checking authentication..." />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // If Creator has not entered a school mode, send them to the Creator Panel
  if (isCreator && !impersonatedSchoolId) {
    return <Navigate to="/creator/dashboard" replace />;
  }

  if (permission && user && !hasPermission(user.role, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (featureId && !isFeatureEnabled(featureId)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function CreatorRoute() {
  const { isAuthenticated, isLoading, isCreator } = useAuth();

  if (isLoading) return <LoadingSpinner message="Verifying Creator credentials..." />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!isCreator) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated, isLoading, isCreator, impersonatedSchoolId } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  if (isAuthenticated) {
    if (isCreator && !impersonatedSchoolId) {
      return <Navigate to="/creator/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
