import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { cn } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isCreator, impersonatedSchoolId, exitSchool } = useAuth();
  const { schoolSettings } = useApp();
  const navigate = useNavigate();

  const handleExitSchool = async () => {
    await exitSchool();
    navigate('/creator/dashboard');
  };

  const hasCreatorBanner = isCreator && Boolean(impersonatedSchoolId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {hasCreatorBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 h-9 bg-gradient-to-r from-amber-600 via-indigo-600 to-purple-700 text-white px-4 flex items-center justify-between text-xs font-medium shadow-md">
          <div className="flex items-center gap-2">
            <span className="bg-black/30 text-amber-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Creator Mode
            </span>
            <span className="hidden sm:inline">
              Viewing <strong>{(schoolSettings?.schoolName as string) || 'School'}</strong> with root manage privileges
            </span>
          </div>
          <button
            onClick={handleExitSchool}
            className="bg-white/95 hover:bg-white text-gray-900 px-2.5 py-1 rounded font-semibold flex items-center gap-1.5 transition-all shadow-sm hover:scale-105"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit to Creator Panel</span>
          </button>
        </div>
      )}

      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className={cn(hasCreatorBanner && 'pt-9')}>
        <TopNav sidebarCollapsed={sidebarCollapsed} />
      </div>

      <main className={cn(
        'min-h-screen transition-all duration-300',
        hasCreatorBanner ? 'pt-24' : 'pt-16',
        sidebarCollapsed ? 'pl-[70px]' : 'pl-[260px]'
      )}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
