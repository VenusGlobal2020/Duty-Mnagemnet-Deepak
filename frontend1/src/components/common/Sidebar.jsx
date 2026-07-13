import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, LogOut, X, ExternalLink, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleLabel } from '../../utils/helpers';
import useLeaveNotifBadge from '../../hooks/useLeaveNotifBadge';
import ThemeToggle from '../common/ThemeToggle';

export default function Sidebar({ navItems, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Unread leave-related notifications (new request awaiting decision, a
  // decision on your own request, conflicts, threshold locks...) — used to
  // highlight the "अवकाश प्रबंधन" tab below so it's obvious something needs
  // attention without having to open the bell dropdown first.
  const leaveUnreadCount = useLeaveNotifBadge();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-ink-900 text-ink-700 dark:text-ink-100 relative overflow-hidden border-r border-ink-200/70 dark:border-white/[0.06]">
      {/* faint structural grid + soft aurora wash — signature texture of the rail */}
      <div className="absolute inset-0 bg-grid-faint bg-[length:28px_28px] opacity-40 dark:hidden pointer-events-none" />
      <div className="absolute -top-24 -left-16 w-64 h-64 rounded-full bg-signal-400/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-10 w-56 h-56 rounded-full bg-signal2-400/10 blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className="relative flex items-center justify-between px-4 py-4 border-b border-ink-200/70 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-signal-500 to-signal-700 flex items-center justify-center shadow-glow-signal shrink-0">
            <Shield className="w-5 h-5 text-white" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold font-display text-ink-900 dark:text-white tracking-wide">DUTY<span className="text-signal-500">OPS</span></p>
            <p className="text-[11px] text-ink-400 font-mono tracking-wide">CONTROL CENTER</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/5 lg:hidden">
            <X className="w-4 h-4 text-ink-400" />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="relative px-4 py-3.5 border-b border-ink-200/70 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-signal-500 to-signal2-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
            {user?.name?.[0]?.toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-ink-900 animate-pulseDot" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-ink-400 font-mono uppercase tracking-wide">{getRoleLabel(user?.role)}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          if (item.type === 'external') {
            return (
              <a
                key={item.to}
                href={item.to}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="sidebar-link sidebar-link-inactive group"
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-ink-400 group-hover:text-signal-500 transition-colors shrink-0" />
              </a>
            );
          }

          // Highlight this item when it's the leave module and there's an
          // unread leave notification (new request, decision, conflict...).
          const isLeaveTab = item.to.endsWith('/leave');
          const showLeaveBadge = isLeaveTab && leaveUnreadCount > 0;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${
                  showLeaveBadge && !isActive ? 'ring-1 ring-signal-400/60 bg-signal-50/70 dark:bg-signal-500/[0.08]' : ''
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative shrink-0">
                    <item.icon className="w-4 h-4" />
                    {showLeaveBadge && (
                      <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-signal-500 ring-2 ring-white dark:ring-ink-900 animate-pulseDot" />
                    )}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.type === 'soon' && (
                    <span className={`text-[9px] font-mono font-semibold tracking-wide px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-ink-100 dark:bg-white/[0.06] text-ink-400'} shrink-0`}>
                      SOON
                    </span>
                  )}
                  {showLeaveBadge && (
                    <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0 ${isActive ? 'bg-white/25 text-white' : 'bg-signal-500 text-white'}`}>
                      {leaveUnreadCount > 9 ? '9+' : leaveUnreadCount}
                    </span>
                  )}
                  {isActive && !item.type && <ChevronRight className="w-3.5 h-3.5 text-white/80 shrink-0" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="relative p-3 border-t border-ink-200/70 dark:border-white/[0.06] space-y-1">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="sidebar-link sidebar-link-inactive w-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}