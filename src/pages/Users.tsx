import { useState } from 'react';
import { useUsers } from '@/hooks/use-users';
import { toast } from 'sonner';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Key } from 'lucide-react';

export default function Users() {
  const { user: currentUser } = useAuth();
  const { users, loading, updateUserRole, inviteUser, deleteUser, updateUserPermissions } = useUsers();
  
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<any>(null);
  
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('employee');
  const [invitePermissions, setInvitePermissions] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Determine permissions payload: Viewers get strictly read-only, Admins get null/all natively, else specific
    let finalPerms: any = invitePermissions;
    if (inviteRole === 'admin') finalPerms = ["all"];
    if (inviteRole === 'viewer') {
      finalPerms = Object.keys(invitePermissions).reduce((acc, mod) => {
        if (invitePermissions[mod]?.length > 0) acc[mod] = ['read'];
        return acc;
      }, {} as any);
    }
    
    // In a real app we'd pass permissions to inviteUser edge function
    // For now we assume inviteUser just sets the role, we might need to modify edge function or profile directly later
    // As a workaround, we will call updateUserPermissions immediately after if we have the new user ID
    
    // NOTE: Edge function 'manage-users' currently only accepts email, name, role. 
    // It creates them in auth.users and profiles. We'll add permissions into the edge function later if needed,
    // but for now let's just use the hook.
    const success = await inviteUser(inviteEmail, inviteName, inviteRole, finalPerms);
    if (success) {
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('employee');
      setInvitePermissions({});
    }
    setIsSubmitting(false);
  };
  
  const PERMISSION_MODULES = ['inventory', 'orders', 'customers', 'delivery'];
  const PERMISSION_ACTIONS = ['read', 'write', 'delete'];

  const handleOpenPermissions = (user: any) => {
    setEditingPermissionsUser(user);
    if (Array.isArray(user.permissions) && user.permissions.includes('all')) {
       // If they have full array 'all', represent it as full access checkboxes
       const full: any = {};
       PERMISSION_MODULES.forEach(m => full[m] = ['all']);
       setInvitePermissions(full);
    } else {
       setInvitePermissions(user.permissions || {});
    }
    setIsPermissionsOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!editingPermissionsUser) return;
    try {
      setIsSubmitting(true);
      
      let finalPerms: any = invitePermissions;
      if (editingPermissionsUser.role === 'viewer') {
        finalPerms = Object.keys(invitePermissions).reduce((acc, mod) => {
          if (invitePermissions[mod]?.length > 0) acc[mod] = ['read'];
          return acc;
        }, {} as Record<string, string[]>);
      }
      
      const success = await updateUserPermissions(editingPermissionsUser.id, finalPerms);
      if (success) {
        setIsPermissionsOpen(false);
      }
    } catch (e: any) {
      toast.error('Failed to save permissions: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const togglePermission = (module: string, action: string, currentPerms: Record<string, string[]>, setPerms: (p: Record<string, string[]>) => void) => {
     const newPerms = { ...currentPerms };
     if (!newPerms[module]) newPerms[module] = [];
     
     if (action === 'all') {
        newPerms[module] = newPerms[module].includes('all') ? [] : ['all'];
     } else {
        // If they had 'all', break it down to specific ones except the one being toggled off
        if (newPerms[module].includes('all')) {
           newPerms[module] = PERMISSION_ACTIONS.filter(a => a !== action);
        } else {
           if (newPerms[module].includes(action)) {
              newPerms[module] = newPerms[module].filter(a => a !== action);
           } else {
              newPerms[module] = [...newPerms[module], action];
              // If they have all actions, simplify to 'all'
              if (PERMISSION_ACTIONS.every(a => newPerms[module].includes(a))) {
                 newPerms[module] = ['all'];
              }
           }
        }
     }
     
     // Clean up empty modules
     if (newPerms[module].length === 0) delete newPerms[module];
     
     setPerms(newPerms);
  };

  const renderPermissionMatrix = (perms: Record<string, string[]>, setPerms: (p: Record<string, string[]>) => void, role: UserRole) => {
     if (role === 'admin') {
        return <div className="text-sm p-4 text-center bg-muted/50 rounded-md text-muted-foreground border border-dashed border-border/50">Admin users automatically have all permissions.</div>;
     }
     
     const isViewer = role === 'viewer';
     
     return (
        <div className="space-y-4">
           {isViewer && (
              <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded flex items-center mb-4">
                 <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-2" />
                 Viewer role restricts all assignments to strictly "read-only" access automatically.
              </div>
           )}
           <div className="rounded-md border border-border/50 overflow-hidden">
             <Table>
                <TableHeader className="bg-muted/30">
                   <TableRow>
                      <TableHead>Module</TableHead>
                      {PERMISSION_ACTIONS.map(action => (
                         <TableHead key={action} className="text-center capitalize">{action}</TableHead>
                      ))}
                      <TableHead className="text-center">All</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {PERMISSION_MODULES.map(module => {
                      const modPerms = perms[module] || [];
                      const hasAll = modPerms.includes('all');
                      return (
                         <TableRow key={module}>
                            <TableCell className="font-medium capitalize py-2">{module}</TableCell>
                            {PERMISSION_ACTIONS.map(action => {
                               const isDisabled = isViewer && action !== 'read';
                               return (
                                 <TableCell key={action} className="text-center py-2 relative">
                                    <div className="flex justify-center items-center h-full">
                                      <Checkbox 
                                         checked={hasAll || modPerms.includes(action)}
                                         onCheckedChange={() => togglePermission(module, action, perms, setPerms)}
                                         disabled={isDisabled}
                                         className={isDisabled ? 'opacity-30' : ''}
                                      />
                                    </div>
                                 </TableCell>
                               );
                            })}
                            <TableCell className="text-center py-2 bg-muted/10">
                               <div className="flex justify-center items-center h-full">
                                 <Checkbox 
                                    className="data-[state=checked]:bg-primary"
                                    checked={hasAll}
                                    onCheckedChange={() => togglePermission(module, 'all', perms, setPerms)}
                                    disabled={isViewer}
                                 />
                               </div>
                            </TableCell>
                         </TableRow>
                      )
                   })}
                </TableBody>
             </Table>
           </div>
        </div>
     );
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'admin': return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
      case 'employee': return 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20';
      case 'viewer': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-500 hover:bg-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your team members and fine-grained access roles.
          </p>
        </div>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs tracking-wider uppercase">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation email to a new team member. They will be prompted to set a password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInviteSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input 
                    required 
                    value={inviteName} 
                    onChange={e => setInviteName(e.target.value)} 
                    placeholder="John Doe" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email address</label>
                  <Input 
                    required 
                    type="email" 
                    value={inviteEmail} 
                    onChange={e => setInviteEmail(e.target.value)} 
                    placeholder="john@example.com" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as UserRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium">Initial Permissions</label>
                  {renderPermissionMatrix(invitePermissions, setInvitePermissions, inviteRole)}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        
        <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Permissions</DialogTitle>
              <DialogDescription>
                Edit granular module access for <span className="font-semibold text-foreground">{editingPermissionsUser?.full_name || 'user'}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
               {editingPermissionsUser && renderPermissionMatrix(invitePermissions, setInvitePermissions, editingPermissionsUser.role)}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPermissionsOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleSavePermissions} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Permissions'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-muted-foreground/10 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>User Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>System Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name}
                      {isSelf && <Badge variant="outline" className="ml-2 text-[10px] uppercase">You</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select 
                        value={u.role || 'user'} 
                        onValueChange={(val) => updateUserRole(u.id, val as UserRole)}
                        disabled={isSelf} // Don't let users change their own role accidentally to prevent lockout
                      >
                        <SelectTrigger className={`w-[140px] h-8 text-xs font-bold uppercase tracking-wider ${getRoleBadgeColor(u.role)} border-0`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin" className="text-xs font-bold uppercase tracking-wider text-red-500">Admin</SelectItem>
                          <SelectItem value="employee" className="text-xs font-bold uppercase tracking-wider text-amber-500">Employee</SelectItem>
                          <SelectItem value="viewer" className="text-xs font-bold uppercase tracking-wider text-blue-500">Viewer</SelectItem>
                          <SelectItem value="user" className="text-xs font-bold uppercase tracking-wider text-slate-500">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost" 
                        size="icon"
                        title="Manage Permissions"
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 mr-1"
                        onClick={() => handleOpenPermissions(u)}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" 
                        size="icon"
                        title="Delete User"
                        className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                        disabled={isSelf}
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${u.full_name}?`)) {
                            deleteUser(u.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
