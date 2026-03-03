import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { toast } from 'sonner';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  permissions?: any;
  created_at: string;
}

export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('User role updated successfully');
      return true;
    } catch (error: any) {
      toast.error('Failed to update role: ' + error.message);
      return false;
    }
  };

  const updateUserPermissions = async (userId: string, newPermissions: any) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissions: newPermissions })
        .eq('id', userId);

      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, permissions: newPermissions } : u));
      toast.success('User permissions updated successfully');
      return true;
    } catch (error: any) {
      toast.error('Failed to update permissions: ' + error.message);
      return false;
    }
  };

  const createUser = async (email: string, password: string, fullName: string, role: UserRole, permissions?: any) => {
    try {
      toast.loading('Creating user...');
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'create', email, password, name: fullName, role, permissions }
      });

      if (error) {
        const errorBody = error.context ? await error.context.json().catch(() => null) : null;
        const message = errorBody?.error || error.message;
        console.error('Edge Function error:', { error, errorBody });
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      toast.dismiss();
      toast.success('User created successfully');
      await fetchUsers();
      return true;
    } catch (error: any) {
      toast.dismiss();
      toast.error('Failed to create user: ' + error.message);
      return false;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      toast.loading('Sending reset password email...');
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'reset-password', email }
      });

      if (error) {
        const errorBody = error.context ? await error.context.json().catch(() => null) : null;
        const message = errorBody?.error || error.message;
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      toast.dismiss();
      toast.success('Password reset email sent to ' + email);
      return true;
    } catch (error: any) {
      toast.dismiss();
      toast.error('Failed to send reset email: ' + error.message);
      return false;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      toast.loading('Deleting user...');
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', userId }
      });

      if (error) {
        const errorBody = error.context ? await error.context.json().catch(() => null) : null;
        const message = errorBody?.error || error.message;
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      toast.dismiss();
      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
      return true;
    } catch (error: any) {
      toast.dismiss();
      toast.error('Failed to delete user: ' + error.message);
      return false;
    }
  };

  return { users, loading, fetchUsers, updateUserRole, updateUserPermissions, createUser, resetPassword, deleteUser };
}
