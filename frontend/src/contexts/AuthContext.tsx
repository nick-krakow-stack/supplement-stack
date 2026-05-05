import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';

const TOKEN_KEY = 'ss_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    extra?: {
      health_consent?: boolean;
      age?: number;
      gender?: string;
      guideline_source?: string;
    },
  ) => Promise<authApi.RegisterResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      authApi
        .getMe()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const { token: newToken, user: newUser } = await authApi.login(email, password);
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const register = async (
    email: string,
    password: string,
    extra?: {
      health_consent?: boolean;
      age?: number;
      gender?: string;
      guideline_source?: string;
    },
  ): Promise<authApi.RegisterResponse> => {
    const result = await authApi.register(email, password, extra);
    const { token: newToken, user: newUser } = result;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return result;
  };

  const logout = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async (): Promise<void> => {
    const u = await authApi.getMe();
    setUser(u);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
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
