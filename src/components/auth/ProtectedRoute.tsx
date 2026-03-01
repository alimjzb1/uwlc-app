import { useAuth } from './AuthContext';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();

  // Wait for auth to initialize or profile to load if admin status is needed
  if (loading && (!user || (requireAdmin && !isAdmin))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    console.warn('Unauthorized access attempt to admin route');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
