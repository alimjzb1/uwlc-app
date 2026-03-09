import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, LogOut, Box, Users, Truck, Building2, Cog, Settings, FileText } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut, user, isAdmin, loading, hasPermission } = useAuth();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'employee', 'viewer', 'user'] },
    { to: '/orders', label: 'Orders', icon: ShoppingCart, roles: ['admin', 'employee', 'viewer'], module: 'orders' },
    { to: '/inventory', label: 'Inventory', icon: Box, roles: ['admin', 'employee', 'viewer'], module: 'inventory' },
    { to: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'employee', 'viewer'], module: 'customers' },
    { to: '/delivery', label: 'Delivery', icon: Truck, roles: ['admin', 'employee', 'viewer'], module: 'delivery' },
    { to: '/invoices', label: 'Invoices', icon: FileText, roles: ['admin', 'employee', 'viewer'], module: 'invoices' },
    { to: '/locations', label: 'Locations', icon: Building2, roles: ['admin'], module: 'locations' },
    { to: '/users', label: 'Users', icon: Users, roles: ['admin'], module: 'users' },
    { to: '/integrations', label: 'Integrations', icon: Cog, roles: ['admin'], module: 'integrations' },
    { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'employee', 'viewer', 'user'], module: 'settings' },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      <div className="p-6">
        <h1 className="text-2xl font-bold">UMLC App</h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {loading ? (
          <div className="flex justify-center p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
          </div>
        ) : links.map((link) => {
          const userRole = user?.profile?.role || 'user';
          
          // 1. Admin always sees everything
          if (isAdmin) {
             // Continue to render
          } 
          // 2. If module is specified, check granular permission
          else if (link.module) {
            if (!hasPermission(link.module, 'read')) return null;
          }
          // 3. Fallback to legacy role check
          else if (!link.roles.includes(userRole)) {
            return null;
          }
          
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"
                )
              }
              onClick={onNavigate}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
