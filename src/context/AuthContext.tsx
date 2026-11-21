import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types';
import { apiCall } from '../utils/helpers';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string, schoolCode?: string) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isCreator: boolean;
  impersonatedSchoolId: string | null;
  enterSchool: (schoolId: string) => Promise<void>;
  exitSchool: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('sms_token'));
  const [impersonatedSchoolId, setImpersonatedSchoolId] = useState<string | null>(
    localStorage.getItem('sms_impersonated_school')
  );
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

          // Restore Creator's impersonated school mode if saved
          const storedSchool = localStorage.getItem('sms_impersonated_school');
          if (validUser && validUser.role === 'CREATOR' && storedSchool) {
            try {
              await getDesktopApi().creator.enterSchool(storedSchool);
              setImpersonatedSchoolId(storedSchool);
            } catch {
              localStorage.removeItem('sms_impersonated_school');
              setImpersonatedSchoolId(null);
            }
          }
        } catch {
          localStorage.removeItem('sms_token');
          localStorage.removeItem('sms_impersonated_school');
          setToken(null);
          setUser(null);
          setImpersonatedSchoolId(null);
        }
      }
      setIsLoading(false);
    }
    validateSession();
  }, []);

  const login = useCallback(async (username: string, password: string, schoolCode?: string): Promise<User> => {
    const result = await apiCall(() => getDesktopApi().auth.login(username, password, schoolCode));
    setUser(result.user);
    setToken(result.token);
    setImpersonatedSchoolId(null);
    localStorage.setItem('sms_token', result.token);
    localStorage.removeItem('sms_impersonated_school');
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try { await getDesktopApi().auth.logout(); } catch { /* ignore */ }
    }
    setUser(null);
    setToken(null);
    setImpersonatedSchoolId(null);
    localStorage.removeItem('sms_token');
    localStorage.removeItem('sms_impersonated_school');
  }, [token]);

  const enterSchool = useCallback(async (schoolId: string) => {
    await apiCall(() => getDesktopApi().creator.enterSchool(schoolId));
    setImpersonatedSchoolId(schoolId);
    localStorage.setItem('sms_impersonated_school', schoolId);
  }, []);

  const exitSchool = useCallback(async () => {
    await apiCall(() => getDesktopApi().creator.exitSchool());
    setImpersonatedSchoolId(null);
    localStorage.removeItem('sms_impersonated_school');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      login,
      logout,
      isAuthenticated: !!user,
      isCreator: user?.role === 'CREATOR',
      impersonatedSchoolId,
      enterSchool,
      exitSchool,
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
