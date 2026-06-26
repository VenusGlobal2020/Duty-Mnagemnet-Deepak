import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardList, CheckCircle, XCircle, Building2 } from 'lucide-react';
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
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-signal2-600 dark:text-signal2-400 bg-signal2-50 dark:bg-signal2-400/10 border border-signal2-200 dark:border-signal2-400/20 rounded-full px-2.5 py-0.5 mb-2">
          <Building2 className="w-3 h-3" /> ACP Command
        </span>
        <h1 className="text-2xl font-display font-bold text-ink-900 dark:text-white">ACP Dashboard</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Your area operations overview</p>
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
