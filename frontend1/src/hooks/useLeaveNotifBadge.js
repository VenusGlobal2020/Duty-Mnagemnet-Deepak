import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { LEAVE_NOTIFICATION_TYPES } from '../utils/leaveConstants';

/**
 * Unread count of leave-related notifications (new requests awaiting your
 * decision, decisions on your own requests, conflicts, threshold locks...).
 *
 * Uses the exact same query key + fetch as <NotificationBell>, so React
 * Query dedupes the two into a single shared poll — mounting this alongside
 * the bell (e.g. in the Sidebar) does not add any extra network traffic.
 */
export default function useLeaveNotifBadge() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=30').then(r => r.data.data),
    refetchInterval: 30000,
    enabled: !!user,
  });

  const notifications = data?.notifications || [];
  const leaveUnreadCount = notifications.filter(
    n => !n.isRead && LEAVE_NOTIFICATION_TYPES.includes(n.type)
  ).length;

  return leaveUnreadCount;
}