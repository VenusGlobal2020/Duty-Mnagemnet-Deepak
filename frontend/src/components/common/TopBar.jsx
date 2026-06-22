import { Menu } from 'lucide-react';
import NotificationBell from '../common/NotificationBell';

export default function TopBar({ onMenuClick, title }) {
  return (
    <header className="h-14 flex items-center justify-between px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h1>
      </div>
      <NotificationBell />
    </header>
  );
}
