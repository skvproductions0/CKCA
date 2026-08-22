import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiCall } from '../utils/helpers';

interface AppContextType {
  academicYear: { id: string; name: string } | null;
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  schoolSettings: Record<string, string | boolean | null> | null;
  setAcademicYear: (year: { id: string; name: string }) => void;
  refreshSettings: () => Promise<void>;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [academicYear, setAcademicYearState] = useState<{ id: string; name: string } | null>(null);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string; isCurrent: boolean }[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<Record<string, string | boolean | null> | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sms_dark') === 'true');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sms_dark', String(darkMode));
  }, [darkMode]);

  const refreshSettings = useCallback(async () => {
    if (!window.api) return;
    try {
      const [years, current, settings] = await Promise.all([
        apiCall(() => window.api.academicYears.list()),
        apiCall(() => window.api.academicYears.current()),
        apiCall(() => window.api.settings.getSchool()),
      ]);
      const yearsList = (years as { id: string; name: string; isCurrent: boolean }[]) || [];
      setAcademicYears(yearsList);
      if (current) {
        setAcademicYearState(current as { id: string; name: string });
      } else if (yearsList.length > 0) {
        const active = yearsList.find(y => y.isCurrent) || yearsList[0];
        setAcademicYearState({ id: active.id, name: active.name });
      }
      setSchoolSettings(settings as Record<string, string | boolean | null>);
    } catch { /* ignore on init */ }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshSettings();
    }
  }, [isAuthenticated, refreshSettings]);

  const setAcademicYear = (year: { id: string; name: string }) => {
    setAcademicYearState(year);
  };

  const toggleDarkMode = () => setDarkMode(d => !d);

  return (
    <AppContext.Provider value={{
      academicYear, academicYears, schoolSettings,
      setAcademicYear, refreshSettings, darkMode, toggleDarkMode,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
