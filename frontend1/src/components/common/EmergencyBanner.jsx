import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/helpers';

/**
 * Shows on every authenticated page, for every role, whenever there's an
 * active Emergency Lockdown in the user's hierarchy — this is the
 * always-visible complement to the one-time push notification broadcast
 * sent when the lockdown was declared (see backend emergencyController.js).
 */
export default function EmergencyBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['emergency-active'],
    queryFn: () => api.get('/emergency/active').then(r => r.data.data),
    refetchInterval: 60000,
    enabled: !!user,
  });

  const emergency = data?.emergency;
  if (!emergency) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm shrink-0">
      <Siren className="w-4 h-4 shrink-0 animate-pulse" />
      <p className="flex-1 min-w-0 truncate">
        <span className="font-semibold">Emergency Lockdown active</span>
        <span className="hidden sm:inline"> — {emergency.reason}</span>
        <span className="text-red-100"> ({formatDate(emergency.startDate)} – {formatDate(emergency.endDate)})</span>
      </p>
      {user?.role === 'superadmin' && (
        <button
          onClick={() => navigate('/superadmin/emergency')}
          className="text-xs font-medium underline shrink-0 hover:text-red-100"
        >
          Manage
        </button>
      )}
    </div>
  );
}