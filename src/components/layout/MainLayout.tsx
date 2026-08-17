import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { cn } from '../../utils/helpers';

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <TopNav sidebarCollapsed={sidebarCollapsed} />
      <main className={cn(
        'pt-16 min-h-screen transition-all duration-300',
        sidebarCollapsed ? 'pl-[70px]' : 'pl-[260px]'
      )}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
