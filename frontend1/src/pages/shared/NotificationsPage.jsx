import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';
import api from '../../api/axios';
import { timeAgo } from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const TYPE_META = {
  duty_assigned:     { icon: '📋', label: 'Duty Assigned',       color: 'bg-blue-50 dark:bg-blue-900/10' },
  duty_updated:      { icon: '✏️',  label: 'Duty Updated',        color: 'bg-yellow-50 dark:bg-yellow-900/10' },
  duty_cancelled:    { icon: '❌',  label: 'Duty Cancelled',      color: 'bg-red-50 dark:bg-red-900/10' },
  duty_rejected:     { icon: '🚫', label: 'Officer Rejected',    color: 'bg-orange-50 dark:bg-orange-900/10' },
  officer_replaced:  { icon: '🔄', label: 'Officer Replaced',    color: 'bg-purple-50 dark:bg-purple-900/10' },
  account_suspended: { icon: '🔒', label: 'Account Suspended',   color: 'bg-red-50 dark:bg-red-900/10' },
  account_activated: { icon: '✅', label: 'Account Activated',   color: 'bg-green-50 dark:bg-green-900/10' },
  swap_requested:    { icon: '🔃', label: 'Swap Requested',      color: 'bg-amber-50 dark:bg-amber-900/10' },
  swap_accepted:     { icon: '✅', label: 'Swap Accepted',       color: 'bg-emerald-50 dark:bg-emerald-900/10' },
  swap_rejected:     { icon: '❌', label: 'Swap Rejected',       color: 'bg-red-50 dark:bg-red-900/10' },
  swap_cancelled:    { icon: '↩️', label: 'Swap Cancelled',      color: 'bg-gray-50 dark:bg-gray-900/10' },
  officer_swapped:   { icon: '🔄', label: 'Officer Swapped',     color: 'bg-purple-50 dark:bg-purple-900/10' },
  general:           { icon: '🔔', label: 'General',             color: '' },
};

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-page', page, unreadOnly],
    queryFn: () =>
      api.get(`/notifications?page=${page}&limit=20${unreadOnly ? '&unreadOnly=true' : ''}`)
        .then(r => r.data.data),
  });

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries(['notifications-page']);
      qc.invalidateQueries(['notifications']);
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      toast.success('All notifications marked as read');
      qc.invalidateQueries(['notifications-page']);
      qc.invalidateQueries(['notifications']);
    },
  });

  const deleteN = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['notifications-page']);
      qc.invalidateQueries(['notifications']);
    },
  });

  const notifications = data?.notifications || [];
  const pagination = data?.pagination;
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-500" />
            Notification History
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setUnreadOnly(o => !o); setPage(1); }}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              unreadOnly
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {unreadOnly ? 'Unread only' : 'All'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-60"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{unreadOnly ? 'No unread notifications' : 'No notifications yet'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.map(n => {
              const meta = TYPE_META[n.type] || TYPE_META.general;
              return (
                <div
                  key={n._id}
                  className={`flex gap-3 px-4 py-3.5 group transition-colors ${
                    !n.isRead
                      ? `${meta.color || 'bg-primary-50 dark:bg-primary-900/10'}`
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {/* Icon */}
                  <div className="text-xl shrink-0 mt-0.5 w-7 text-center">{meta.icon}</div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${
                        !n.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {n.body}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                      <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                      <span className="text-xs text-gray-400">{meta.label}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => markRead.mutate(n._id)}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5 text-primary-600" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteN.mutate(n._id)}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <Pagination pagination={pagination} onPageChange={(p) => { setPage(p); window.scrollTo(0, 0); }} />
      )}
    </div>
  );
}