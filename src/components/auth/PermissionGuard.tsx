import React from 'react';
import { useAuth } from './AuthContext';
import { UserRole } from '@/types';

interface PermissionGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: UserRole[];
  module?: string;
  action?: string;
  fallback?: React.ReactNode;
}

/**
 * A component to conditionally render parts of the UI based on user roles and granular permissions.
 */
export function PermissionGuard({ 
  children, 
  requireAdmin = false, 
  allowedRoles, 
  module,
  action,
  fallback = null 
}: PermissionGuardProps) {
  const { user, isAdmin, hasPermission } = useAuth();
  const userRole = user?.profile?.role;

  // 1. Check Admin requirement
  if (requireAdmin && !isAdmin) {
    return <>{fallback}</>;
  }

  // 2. Check Allowed Roles requirement
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <>{fallback}</>;
  }

  // 3. Check Module/Action permissions
  if (module && action && !hasPermission(module, action)) {
    return <>{fallback}</>;
  }

  // 4. Default Check for authenticated user if any restriction is set
  if (!user && (requireAdmin || allowedRoles || (module && action))) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
