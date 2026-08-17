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
  const { academicYear, academicYears, setAcademicYear, darkMode, toggleDarkMode } = useApp();
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
      if (user?.role === 'SUPER_ADMIN') {
        await apiCall(() => window.api.academicYears.setCurrent(yearId));
      }
    }
  };

  return (
    <header className={`fixed top-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30 flex items-center justify-between px-6 transition-all duration-300 ${sidebarCollapsed ? 'left-[70px]' : 'left-[260px]'}`}>
      <div className="flex items-center gap-4">
        {academicYears.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Academic Year:</span>
            <select
              value={academicYear?.id || ''}
              onChange={e => handleYearChange(e.target.value)}
              className="input py-1.5 px-3 w-auto text-sm"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
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
