import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, UserCheck, Plus, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import StatCard from '../../components/common/StatCard';
import { formatDateTime, getPriorityColor, getPriorityLabel, getStatusColor, getDutyTypeColor } from '../../utils/helpers';

export default function OperatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSpecial = user?.role === 'operator_special';

  const { data: dutiesData } = useQuery({
    queryKey: ['op-duties-recent'],
    queryFn: () => api.get('/operator/duties?limit=5&status=active').then(r => r.data.data),
  });

  const { data: allDuties } = useQuery({
    queryKey: ['op-duties-stats'],
    queryFn: () => api.get('/operator/duties?limit=1').then(r => r.data.data),
  });

  const { data: officersData } = useQuery({
    queryKey: ['op-officers-count'],
    queryFn: () => api.get('/operator/officers?limit=1').then(r => r.data.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isSpecial ? 'Special Operator' : 'Regular Operator'} Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Welcome, {user?.name}</p>
        </div>
        <button onClick={() => navigate('/operator/duties/create')} className="btn-primary">
          <Plus className="w-4 h-4" /> New Duty
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Total Duties" value={allDuties?.pagination?.total ?? 0} color="blue" />
        <StatCard icon={CheckCircle} label="Active" value={dutiesData?.pagination?.total ?? 0} color="green" />
        <StatCard icon={UserCheck} label="Officers" value={officersData?.pagination?.total ?? 0} color="purple" />
        <StatCard icon={AlertCircle} label="Role" value={isSpecial ? 'Special' : 'Regular'} color="orange" />
      </div>

      {/* Recent duties */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="section-title">Active Duties</h2>
          <button onClick={() => navigate('/operator/duties')} className="text-sm text-primary-600 hover:underline">View all</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {dutiesData?.data?.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No active duties</p>
              <button onClick={() => navigate('/operator/duties/create')} className="btn-primary mt-3 mx-auto text-sm">
                <Plus className="w-3.5 h-3.5" /> Create First Duty
              </button>
            </div>
          ) : (
            dutiesData?.data?.map(duty => (
              <div
                key={duty._id}
                onClick={() => navigate(`/operator/duties/${duty._id}`)}
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{duty.dutyName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{duty.locationName}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`badge border ${getPriorityColor(duty.priority)}`}>{getPriorityLabel(duty.priority)}</span>
                    {duty.dutyType && <span className={`badge ${getDutyTypeColor(duty.dutyType)}`}>{duty.dutyType}</span>}
                    <span className="text-xs text-gray-400">{formatDateTime(duty.startDate)}</span>
                  </div>
                </div>
                <div className="ml-4 shrink-0">
                  <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span>
                  <p className="text-xs text-gray-400 mt-1">{duty.assignedOfficers?.length || 0} officers</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
