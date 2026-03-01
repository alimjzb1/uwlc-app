import { useAuth } from './AuthContext';
import { Navigate } from 'react-router-dom';

import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, requireAdmin = false, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();
  const userRole = user?.profile?.role;

  // Wait for auth to initialize or profile to load if admin status is needed
  // Note: We use isAdmin as a reliable fallback in case user.profile.role isn't loaded correctly
  const adminAuthorized = allowedRoles?.includes('admin') && isAdmin;
  
  if (loading && (!user || (requireAdmin && !isAdmin) || (allowedRoles && !userRole && !adminAuthorized))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </div>
    );
  }

  if (!user && !loading) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    console.warn('Unauthorized access attempt to admin route');
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles) {
    // If they are an admin and admin is allowed, let them in regardless of userRole
    const hasAdminOverride = isAdmin && allowedRoles.includes('admin');
    const hasRoleMatch = userRole && allowedRoles.includes(userRole);
    
    if (!hasAdminOverride && !hasRoleMatch) {
      console.warn(`Unauthorized access: user role ${userRole} not in allowed roles`);
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
