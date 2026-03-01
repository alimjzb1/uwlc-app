import { createContext, useContext } from 'react';
import { User } from '@/types';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  hasPermission: (module: string, action: string) => boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  hasPermission: () => false,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);
