import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types';
import { apiCall } from '../utils/helpers';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('sms_token'));
  const [isLoading, setIsLoading] = useState(true);

  function getDesktopApi() {
    if (typeof window === 'undefined' || !window.api || !window.api.auth) {
      throw new Error('Desktop API not available. Please run this app from the Electron desktop client.');
    }
    return window.api;
  }

  useEffect(() => {
    async function validateSession() {
      const storedToken = localStorage.getItem('sms_token');
      if (storedToken) {
        try {
          const validUser = await apiCall(() => getDesktopApi().auth.validate(storedToken));
          setUser(validUser);
          setToken(storedToken);
        } catch {
          localStorage.removeItem('sms_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    validateSession();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiCall(() => getDesktopApi().auth.login(username, password));
    setUser(result.user);
    setToken(result.token);
    localStorage.setItem('sms_token', result.token);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try { await getDesktopApi().auth.logout(); } catch { /* ignore */ }
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('sms_token');
  }, [token]);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, login, logout,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
