import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiCall } from '../utils/helpers';

interface AppContextType {
  academicYear: { id: string; name: string } | null;
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  schoolSettings: Record<string, any> | null;
  features: Record<string, boolean>;
  isFeatureEnabled: (featureId: string) => boolean;
  plan: string;
  licenseWarning: string | null;
  limits: { maxStudents: number; maxStaff: number; licenseExpiresAt: string | null };
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
  const [schoolSettings, setSchoolSettings] = useState<Record<string, any> | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<string>('PREMIUM');
  const [licenseWarning, setLicenseWarning] = useState<string | null>(null);
  const [limits, setLimits] = useState<{ maxStudents: number; maxStaff: number; licenseExpiresAt: string | null }>({
    maxStudents: 1000,
    maxStaff: 100,
    licenseExpiresAt: null,
  });
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
      const settingsRecord = (settings as Record<string, any>) || null;
      setSchoolSettings(settingsRecord);
      if (settingsRecord) {
        if (settingsRecord.features) {
          setFeatures(settingsRecord.features as Record<string, boolean>);
        }
        if (settingsRecord.plan) {
          setPlan(settingsRecord.plan as string);
        }
        if (settingsRecord.licenseWarning !== undefined) {
          setLicenseWarning(settingsRecord.licenseWarning as string | null);
        }
        setLimits({
          maxStudents: Number(settingsRecord.maxStudents) || 1000,
          maxStaff: Number(settingsRecord.maxStaff) || 100,
          licenseExpiresAt: (settingsRecord.licenseExpiresAt as string) || null,
        });
      }
    } catch { /* ignore on init */ }
  }, []);

  useEffect(() => {
    if (schoolSettings) {
      if (schoolSettings.primaryColor) {
        document.documentElement.style.setProperty('--brand-primary', schoolSettings.primaryColor as string);
      }
      if (schoolSettings.secondaryColor) {
        document.documentElement.style.setProperty('--brand-secondary', schoolSettings.secondaryColor as string);
      }
      if (schoolSettings.faviconPath) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
        if (link) {
          link.href = schoolSettings.faviconPath as string;
        }
      }
    }
  }, [schoolSettings]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshSettings();
    }
  }, [isAuthenticated, refreshSettings]);

  const setAcademicYear = (year: { id: string; name: string }) => {
    setAcademicYearState(year);
  };

  const isFeatureEnabled = useCallback(
    (featureId: string): boolean => {
      if (!features || Object.keys(features).length === 0) return true;
      return features[featureId] !== false;
    },
    [features]
  );

  const toggleDarkMode = () => setDarkMode(d => !d);

  return (
    <AppContext.Provider value={{
      academicYear, academicYears, schoolSettings,
      features, isFeatureEnabled, plan, licenseWarning, limits,
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
