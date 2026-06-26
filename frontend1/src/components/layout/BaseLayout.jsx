import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import TopBar from '../common/TopBar';

export default function BaseLayout({ navItems }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Derive page title from current nav item (external links never match a pathname)
  const currentNav = navItems.find(n => {
    if (n.type === 'external') return false;
    if (n.end) return location.pathname === n.to;
    return location.pathname.startsWith(n.to);
  });
  const pageTitle = currentNav?.label || 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-ink-100 dark:bg-ink-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:flex-col w-[272px] shrink-0">
        <Sidebar navItems={navItems} />
      </aside>

      {/* Sidebar - mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[272px] flex flex-col transform transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar navItems={navItems} onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title={pageTitle} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto animate-fadeUp">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
