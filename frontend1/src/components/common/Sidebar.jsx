import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, LogOut, X, ExternalLink, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleLabel } from '../../utils/helpers';
import ThemeToggle from '../common/ThemeToggle';

export default function Sidebar({ navItems, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-ink-900 dark:bg-ink-950 text-ink-100 relative overflow-hidden">
      {/* faint structural grid, signature texture of the console rail */}
      <div className="absolute inset-0 bg-grid-faint bg-[length:28px_28px] opacity-[0.4] pointer-events-none" />
      {/* accent edge */}
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-signal2-400/40 via-ink-700/0 to-signal-400/30" />

      {/* Logo */}
      <div className="relative flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-signal-400 to-signal-600 flex items-center justify-center shadow-glow-signal shrink-0">
            <Shield className="w-5 h-5 text-ink-950" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold font-display text-white tracking-wide">DUTY<span className="text-signal-400">OPS</span></p>
            <p className="text-[11px] text-ink-400 font-mono tracking-wide">CONTROL CENTER</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 lg:hidden">
            <X className="w-4 h-4 text-ink-300" />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="relative px-4 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full bg-signal2-400/15 border border-signal2-400/30 flex items-center justify-center text-signal2-300 font-bold text-sm shrink-0">
            {user?.name?.[0]?.toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-ink-900 animate-pulseDot" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
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
                <ExternalLink className="w-3.5 h-3.5 text-ink-500 group-hover:text-signal-400 transition-colors shrink-0" />
              </a>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-signal-400 shadow-glow-signal" />
                  )}
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.type === 'soon' && (
                    <span className="text-[9px] font-mono font-semibold tracking-wide px-1.5 py-0.5 rounded bg-white/[0.06] text-ink-400 shrink-0">
                      SOON
                    </span>
                  )}
                  {isActive && !item.type && <ChevronRight className="w-3.5 h-3.5 text-signal-400 shrink-0" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="relative p-3 border-t border-white/[0.06] space-y-1">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="sidebar-link sidebar-link-inactive w-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
