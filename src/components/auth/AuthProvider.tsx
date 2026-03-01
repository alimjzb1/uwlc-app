import { useEffect, useState, useCallback, useMemo } from 'react';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProfile = useCallback(async (userId: string) => {
    // Add a timeout to profile fetch to prevent hanging the whole app
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Profile fetch timeout")), 10000)
    );

    try {
      console.log(`[Auth] Fetching profile for ${userId}...`);
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data: profile, error } = await Promise.race([
        fetchPromise,
        timeoutPromise as Promise<any>
      ]);

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      console.log('Profile fetched successfully:', { userId, role: profile?.role });
      return profile;
    } catch (e: any) {
      console.error('Unexpected error or timeout fetching profile:', e.message);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profile = await fetchProfile(user.id);
    if (profile) {
      setUser(prev => prev ? { ...prev, profile } : null);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;
    const lastFetchedId = { current: '' };

    // Emergency global timeout: force loading to false after 15s no matter what
    const emergencyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.error("[Auth] EMERGENCY TIMEOUT: Force loading false.");
        setLoading(false);
      }
    }, 15000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log("[Auth] Event:", event, session?.user?.id);

      if (event === 'SIGNED_OUT' || !session?.user) {
        lastFetchedId.current = '';
        setUser(null);
        setLoading(false);
        return;
      }

      // If we have a user and haven't fetched their profile yet in this session
      if (session.user.id !== lastFetchedId.current) {
        lastFetchedId.current = session.user.id;
        console.log("[Auth] New session or user, fetching profile...");
        const profile = await fetchProfile(session.user.id);
        
        if (mounted) {
          // Properly type and assign the profile so it's accessible as user.profile.role
          setUser({ ...session.user, profile } as unknown as User);
          clearTimeout(emergencyTimeout);
          setLoading(false);
        }
      } else if (mounted) {
        // Already fetched or fetching for this user ID, but we shouldn't wipe the user.
        // Keep the existing user (which has the profile) or just update session details 
        // without wiping the profile.
        setUser(prev => prev ? { ...session.user, profile: prev.profile } as unknown as User : null);
        setLoading(false);
      }
    });

    // Explicit check on mount just in case event is missed or slow
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted && !session?.user) {
            // If no session found immediately, we can stop waiting for INITIAL_SESSION if helpful
            // but usually INITIAL_SESSION fires. We'll wait for the emergency timeout to be safe.
        }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async () => {
      // Logic handled in Login page
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isAdmin = useMemo(() => {
    // 1. Check profile role
    if (user?.profile?.role === 'admin') return true;
    
    // 2. Fallback for master email (useful during initial setup or if profile trigger fails)
    const masterEmails = ['alimajzoub007@gmail.com', 'admin@example.com'];
    if (user?.email && masterEmails.includes(user.email)) return true;
    
    return false;
  }, [user]);

  const hasPermission = useCallback((module: string, action: string): boolean => {
    if (isAdmin) return true;
    const permissions = user?.profile?.permissions as any;
    
    // Support generic array of permissions, e.g. ["all"]
    if (Array.isArray(permissions) && permissions.includes('all')) return true;
    
    // Support module-specific permissions, e.g. { "inventory": ["read", "write"] }
    const modulePermissions = permissions?.[module] || [];
    return modulePermissions.includes('all') || modulePermissions.includes(action);
  }, [isAdmin, user]);

  const value = useMemo(() => ({
    user,
    loading,
    isAdmin,
    hasPermission,
    signIn,
    signOut,
    refreshProfile
  }), [user, loading, isAdmin, hasPermission, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
