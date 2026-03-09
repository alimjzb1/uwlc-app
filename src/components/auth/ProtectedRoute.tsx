import { useAuth } from './AuthContext';
import { Navigate } from 'react-router-dom';

import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: UserRole[];
  module?: string;
  action?: string;
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false, 
  allowedRoles,
  module,
  action = 'read'
}: ProtectedRouteProps) {
  const { user, loading, isAdmin, hasPermission } = useAuth();
  const userRole = user?.profile?.role;

  // Wait for auth to initialize or profile to load if admin status is needed
  if (loading && (!user || (requireAdmin && !isAdmin))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </div>
    );
  }

  if (!user && !loading) {
    return <Navigate to="/login" replace />;
  }

  // 1. Admin Override
  if (isAdmin) {
    return <>{children}</>;
  }

  // 2. Strict Admin Required
  if (requireAdmin && !isAdmin) {
    console.warn('Unauthorized access attempt to admin route');
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Module-based Permission Check (Priority)
  if (module) {
    if (!hasPermission(module, action)) {
      console.warn(`Unauthorized access: user lacks ${action} permission for module ${module}`);
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // 4. Role-based Check (Fallback)
  if (allowedRoles) {
    const hasRoleMatch = userRole && allowedRoles.includes(userRole);
    
    if (!hasRoleMatch) {
      console.warn(`Unauthorized access: user role ${userRole} not in allowed roles`);
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
