import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, CheckCircle, MapPin, Clock, AlertCircle, XCircle, ShieldCheck } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime, getPriorityLabel, getPriorityColor, getStatusColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import toast from 'react-hot-toast';

export default function OfficerDashboard() {
  const { user } = useAuth();

  const { data: activeDuties = [] } = useQuery({
    queryKey: ['officer-active'],
    queryFn: () => api.get('/officer/duties/active').then(r => r.data.data.duties),
    refetchInterval: 60000,
  });

  const { data: historyData } = useQuery({
    queryKey: ['officer-history-count'],
    queryFn: () => api.get('/officer/duties/history?limit=1').then(r => r.data.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-signal2-600 dark:text-signal2-400 bg-signal2-50 dark:bg-signal2-400/10 border border-signal2-200 dark:border-signal2-400/20 rounded-full px-2.5 py-0.5 mb-2">
          <ShieldCheck className="w-3 h-3" /> Field Officer
        </span>
        <h1 className="text-2xl font-display font-bold text-ink-900 dark:text-white">My Dashboard</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Welcome, {user?.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={ClipboardList} label="My Duties" value={activeDuties.length} color="blue" />
        <StatCard icon={CheckCircle} label="Past Duties" value={historyData?.pagination?.total ?? 0} color="green" />
      </div>

      {activeDuties.length > 0 ? (
        <div className="card">
          <div className="p-4 border-b border-ink-100 dark:border-white/[0.06]">
            <h2 className="section-title">My Upcoming &amp; Live Duties</h2>
          </div>
          <div className="divide-y divide-ink-100 dark:divide-white/[0.05]">
            {activeDuties.map(duty => (
              <div key={duty._id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white">{duty.dutyName}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{duty.locationName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`badge ${getStatusColor(duty.status)}`}>
                      {duty.status === 'draft' ? 'Upcoming' : 'Live'}
                    </span>
                    <span className={`badge border ${getPriorityColor(duty.priority)}`}>
                      {getPriorityLabel(duty.priority)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-ink-400 font-mono">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(duty.startDate)} → {formatDateTime(duty.endDate)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center text-ink-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No duties assigned right now</p>
        </div>
      )}
    </div>
  );
}
