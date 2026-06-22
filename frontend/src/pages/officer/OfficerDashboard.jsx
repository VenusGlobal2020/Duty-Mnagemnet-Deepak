import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, CheckCircle, MapPin, Clock, AlertCircle, XCircle } from 'lucide-react';
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Welcome, {user?.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={ClipboardList} label="Active Duties" value={activeDuties.length} color="blue" />
        <StatCard icon={CheckCircle} label="Past Duties" value={historyData?.pagination?.total ?? 0} color="green" />
      </div>

      {activeDuties.length > 0 ? (
        <div className="card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="section-title">Current Active Duties</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {activeDuties.map(duty => (
              <div key={duty._id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{duty.dutyName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{duty.locationName}
                    </p>
                  </div>
                  <span className={`badge border ${getPriorityColor(duty.priority)}`}>
                    {getPriorityLabel(duty.priority)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(duty.startDate)} → {formatDateTime(duty.endDate)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No active duties assigned</p>
        </div>
      )}
    </div>
  );
}
