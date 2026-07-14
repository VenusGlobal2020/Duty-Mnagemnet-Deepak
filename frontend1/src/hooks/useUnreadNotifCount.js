import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

/**
 * Total unread notification count (all types) — used to badge the
 * "सूचनाएं" (Notifications) sidebar tab.
 *
 * Uses the exact same query key + fetch as <NotificationBell> and
 * useLeaveNotifBadge, so React Query dedupes this into the same shared
 * poll — mounting this in the Sidebar adds no extra network traffic.
 */
export default function useUnreadNotifCount() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=30').then(r => r.data.data),
    refetchInterval: 30000,
    enabled: !!user,
  });

  return data?.unreadCount || 0;
}
