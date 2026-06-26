import { useEffect, useState } from 'react';
import { Menu, Circle } from 'lucide-react';
import NotificationBell from '../common/NotificationBell';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TopBar({ onMenuClick, title }) {
  const now = useClock();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-white/90 dark:bg-ink-900/90 backdrop-blur-md border-b border-ink-200/70 dark:border-white/[0.06] shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-white/5 lg:hidden shrink-0"
        >
          <Menu className="w-5 h-5 text-ink-600 dark:text-ink-300" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold font-display text-ink-900 dark:text-white truncate tracking-tight">{title}</h1>
          <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
            <Circle className="w-2 h-2 text-emerald-500 fill-emerald-500" />
            <span className="text-[11px] text-ink-400 dark:text-ink-400 font-mono uppercase tracking-wide">System online</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5 shrink-0">
        <div className="hidden md:flex flex-col items-end leading-tight">
          <span className="text-sm font-mono font-semibold text-ink-700 dark:text-ink-100 tabular-nums">{time}</span>
          <span className="text-[11px] text-ink-400 dark:text-ink-500 font-mono">{date}</span>
        </div>
        <div className="w-px h-8 bg-ink-200 dark:bg-white/10 hidden md:block" />
        <NotificationBell />
      </div>
    </header>
  );
}
