import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, LogOut, Box, Users, Truck, Building2, Cog } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { signOut, user, isAdmin } = useAuth();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'employee', 'viewer', 'user'] },
    { to: '/orders', label: 'Orders', icon: ShoppingCart, roles: ['admin', 'employee', 'viewer'] },
    { to: '/inventory', label: 'Inventory', icon: Box, roles: ['admin', 'employee', 'viewer'] },
    { to: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'employee', 'viewer'] },
    { to: '/delivery', label: 'Delivery', icon: Truck, roles: ['admin', 'employee', 'viewer'] },
    { to: '/locations', label: 'Locations', icon: Building2, roles: ['admin'] },
    { to: '/users', label: 'Users', icon: Users, roles: ['admin'] },
    { to: '/integrations', label: 'Integrations', icon: Cog, roles: ['admin'] },
  ];

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      <div className="p-6">
        <h1 className="text-2xl font-bold">UMLC App</h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {links.map((link) => {
          const userRole = user?.profile?.role || 'user';
          // If the profile fetch failed but AuthProvider guarantees they're a master admin, let them see admin links
          if (!link.roles.includes(userRole) && (!isAdmin || !link.roles.includes('admin'))) return null;
          
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
