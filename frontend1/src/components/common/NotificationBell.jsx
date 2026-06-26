import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, ArrowRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import { timeAgo } from '../../utils/helpers';

const TYPE_ICONS = {
  duty_assigned:     '📋',
  duty_updated:      '✏️',
  duty_cancelled:    '❌',
  duty_rejected:     '🚫',
  officer_replaced:  '🔄',
  account_suspended: '🔒',
  account_activated: '✅',
  general:           '🔔',
};

// Resolve the "View all notifications" path based on the user's role
function useNotifPath() {
  const { user } = useAuth();
  if (!user) return '/';
  if (user.role === 'officer') return '/officer/notifications';
  if (user.role?.startsWith('operator')) return '/operator/notifications';
  if (user.role === 'admin') return '/admin/notifications';
  if (user.role === 'superadmin') return '/superadmin/notifications';
  if (user.role === 'master') return '/master/notifications';
  return '/';
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notifPath = useNotifPath();

  // Fix #3 — fetch up to 30 recent notifications for the dropdown
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=30').then(r => r.data.data),
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  const deleteN = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notifications = data?.notifications || [];
  const unread = data?.unreadCount || 0;
  const total = data?.pagination?.total || 0;

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-white/5 transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-ink-600 dark:text-ink-300" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-signal-500 text-ink-950 text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-ink-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 card shadow-xl z-50 overflow-hidden animate-fadeUp">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200/70 dark:border-white/[0.06]">
            <span className="text-sm font-semibold text-ink-900 dark:text-white">
              Notifications
              {unread > 0 && (
                <span className="ml-1.5 text-xs bg-signal-100 text-signal-700 dark:bg-signal-500/15 dark:text-signal-300 px-1.5 py-0.5 rounded-full font-medium">
                  {unread} new
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1 text-xs text-signal2-600 dark:text-signal2-400 hover:underline disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* Notification list — Fix #3: shows only this user's notifications */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-ink-100 dark:divide-white/[0.05]">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-ink-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                No notifications
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  className={`flex gap-3 px-4 py-3 group hover:bg-ink-50 dark:hover:bg-white/[0.03] transition-colors ${
                    !n.isRead ? 'bg-signal2-50/60 dark:bg-signal2-400/[0.06]' : ''
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-white truncate">{n.title}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-ink-400 mt-1 font-mono">{timeAgo(n.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => markRead.mutate(n._id)}
                        className="p-1 rounded hover:bg-ink-200 dark:hover:bg-white/10"
                        title="Mark read"
                      >
                        <Check className="w-3 h-3 text-signal2-600 dark:text-signal2-400" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteN.mutate(n._id)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer — Fix #3: "View all" navigates to full notification history */}
          <div className="px-4 py-2.5 border-t border-ink-200/70 dark:border-white/[0.06] bg-ink-50/60 dark:bg-white/[0.02]">
            <button
              onClick={() => { setOpen(false); navigate(notifPath); }}
              className="flex items-center justify-center gap-1.5 w-full text-xs text-signal2-600 dark:text-signal2-400 hover:underline font-medium"
            >
              View all notifications
              {total > 30 && <span className="text-ink-400">({total} total)</span>}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
