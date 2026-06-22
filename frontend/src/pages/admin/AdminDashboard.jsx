import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardList, CheckCircle, XCircle } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/common/StatCard';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ACP Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your area operations overview</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Operators" value={stats?.operators} color="blue" />
        <StatCard icon={Users} label="Officers" value={stats?.officers} color="green" />
        <StatCard icon={ClipboardList} label="Total Duties" value={stats?.totalDuties} color="purple" />
        <StatCard icon={ClipboardList} label="Active Duties" value={stats?.activeDuties} color="orange" />
        <StatCard icon={CheckCircle} label="Completed" value={stats?.completedDuties} color="green" />
        <StatCard icon={XCircle} label="Cancelled" value={stats?.cancelledDuties} color="red" />
      </div>
    </div>
  );
}
