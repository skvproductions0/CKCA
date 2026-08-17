import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, GraduationCap, BookOpen,
  CreditCard, Wallet, ClipboardCheck, FileText, BarChart3,
  Bell, Database, Settings, ChevronLeft, ChevronRight, School,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { hasPermission, cn } from '../../utils/helpers';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard' },
  { path: '/students', label: 'Students', icon: Users, permission: 'students' },
  { path: '/admissions', label: 'Admissions', icon: UserPlus, permission: 'admissions' },
  { path: '/classes', label: 'Classes & Sections', icon: School, permission: 'classes' },
  { path: '/teachers', label: 'Teachers', icon: GraduationCap, permission: 'teachers' },
  { path: '/subjects', label: 'Subjects', icon: BookOpen, permission: 'subjects' },
  { path: '/fees', label: 'Fees', icon: CreditCard, permission: 'fees' },
  { path: '/payments', label: 'Payments', icon: Wallet, permission: 'payments' },
  { path: '/attendance', label: 'Attendance', icon: ClipboardCheck, permission: 'attendance' },
  { path: '/examinations', label: 'Examinations', icon: FileText, permission: 'exams' },
  { path: '/results', label: 'Results', icon: BarChart3, permission: 'results' },
  { path: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports' },
  { path: '/notifications', label: 'Notifications', icon: Bell, permission: 'notifications' },
  { path: '/backup', label: 'Backup & Restore', icon: Database, permission: '*' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'settings.limited' },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const { schoolSettings } = useApp();

  const filteredItems = navItems.filter(item =>
    user && hasPermission(user.role, item.permission)
  );

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full bg-sidebar text-white z-40 transition-all duration-300 flex flex-col',
      collapsed ? 'w-[70px]' : 'w-[260px]'
    )}>
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
          <School className="w-6 h-6" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm leading-tight truncate">
              {(schoolSettings?.schoolName as string) || 'School Management'}
            </h1>
            <p className="text-xs text-gray-400">Management System</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {filteredItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              isActive
                ? 'bg-sidebar-active text-white'
                : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center justify-center p-3 border-t border-white/10 text-gray-400 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </aside>
  );
}
