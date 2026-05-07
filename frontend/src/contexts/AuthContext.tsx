import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    extra?: {
      health_consent?: boolean;
      age?: number;
      guideline_source?: string;
    },
  ) => Promise<authApi.RegisterResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    authApi
      .getMe()
      .then((u) => setUser(u))
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const { user: newUser } = await authApi.login(email, password);
    setUser(newUser);
    return newUser;
  };

  const register = async (
    email: string,
    password: string,
    extra?: {
      health_consent?: boolean;
      age?: number;
      guideline_source?: string;
    },
  ): Promise<authApi.RegisterResponse> => {
    const result = await authApi.register(email, password, extra);
    const { user: newUser } = result;
    setUser(newUser);
    return result;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Local logout must complete even if the backend cookie clear request fails.
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async (): Promise<void> => {
    const u = await authApi.getMe();
    setUser(u);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin: user?.role === 'admin',
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
