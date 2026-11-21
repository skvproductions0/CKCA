import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Moon, Sun, ChevronDown, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ROLE_LABELS, apiCall } from '../../utils/helpers';

interface TopNavProps {
  sidebarCollapsed: boolean;
}

export function TopNav({ sidebarCollapsed }: TopNavProps) {
  const { user, logout } = useAuth();
  const { academicYear, academicYears, setAcademicYear, darkMode, toggleDarkMode, schoolSettings } = useApp();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (window.api) {
      apiCall(() => window.api.notifications.list())
        .then(notifications => {
          const unread = (notifications as { isRead: boolean }[]).filter(n => !n.isRead).length;
          setUnreadCount(unread);
        })
        .catch(() => {});
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleYearChange = async (yearId: string) => {
    const year = academicYears.find(y => y.id === yearId);
    if (year) {
      setAcademicYear({ id: year.id, name: year.name });
    }
  };

  const activeYear = academicYears.find(y => y.isCurrent);
  const isViewingHistorical = academicYear && activeYear && academicYear.id !== activeYear.id;

  return (
    <header className={`fixed top-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30 flex items-center justify-between px-6 transition-all duration-300 ${sidebarCollapsed ? 'left-[70px]' : 'left-[260px]'}`}>
      <div className="flex items-center gap-4">
        {schoolSettings?.schoolName && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="truncate max-w-[220px]">{schoolSettings.schoolName as string}</span>
            {Boolean(schoolSettings.schoolCode) && (
              <span className="opacity-75 font-mono">({schoolSettings.schoolCode as string})</span>
            )}
          </div>
        )}

        {academicYears.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 hidden lg:inline">Session:</span>
            <select
              value={academicYear?.id || ''}
              onChange={e => handleYearChange(e.target.value)}
              className="input py-1 px-2.5 w-auto text-xs font-semibold cursor-pointer"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isCurrent ? '★ (Active)' : '(Closed)'}
                </option>
              ))}
            </select>
            {isViewingHistorical ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 shadow-sm">
                Historical (Read-Only)
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hidden sm:inline shadow-sm">
                Active Session
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
              <User className="w-4 h-4 text-primary-600" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium">{user?.fullName}</p>
              <p className="text-xs text-gray-500">{user && ROLE_LABELS[user.role]}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
