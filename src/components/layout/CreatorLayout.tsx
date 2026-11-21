import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  School,
  ShieldCheck,
  ToggleRight,
  Layers,
  Calendar,
  Activity,
  History,
  Database,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/helpers';

const creatorNavItems = [
  { path: '/creator/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/creator/schools', label: 'Schools', icon: School },
  { path: '/creator/super-admins', label: 'Super Admins', icon: ShieldCheck },
  { path: '/creator/features', label: 'Feature Toggles', icon: ToggleRight },
  { path: '/creator/plans', label: 'Plans', icon: Layers },
  { path: '/creator/sessions', label: 'Sessions', icon: Calendar },
  { path: '/creator/active-users', label: 'Active Users', icon: Activity },
  { path: '/creator/audit', label: 'Audit Log', icon: History },
  { path: '/creator/backup', label: 'Backup & Restore', icon: Database },
  { path: '/creator/settings', label: 'System Settings', icon: Settings },
];

export function CreatorLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, enterSchool } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleQuickEnterSchool = async () => {
    try {
      await enterSchool('default');
      navigate('/dashboard');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex">
      {/* Creator Sidebar with unique Dark-Slate & Amber theme */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-[#0d1424] border-r border-slate-800/80 z-40 transition-all duration-300 flex flex-col',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {/* Creator Brand Header */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-800/80 bg-[#090e1a]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
            <Crown className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-sm tracking-wide text-white">CREATOR</h1>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ROOT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">System Owner Console</p>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {creatorNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 font-semibold border-l-2 border-amber-500 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                )
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Card & Collapse Toggle */}
        <div className="p-3 border-t border-slate-800/80 bg-[#090e1a] space-y-2">
          {!collapsed && (
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.fullName || 'Creator'}</p>
                <p className="text-[10px] text-amber-400/90 font-mono truncate">@{user?.username || 'creator'}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out of Creator account"
                className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-h-screen transition-all duration-300',
          collapsed ? 'pl-[72px]' : 'pl-[260px]'
        )}
      >
        {/* Creator Top Bar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0a101f]/90 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              System Online &bull; Root Mode
            </span>
            <span className="hidden md:inline text-xs text-slate-400">
              Controlling global schools, features, and database integrity
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleQuickEnterSchool}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white shadow-md transition-all hover:scale-105"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Enter CK Career Academy</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
