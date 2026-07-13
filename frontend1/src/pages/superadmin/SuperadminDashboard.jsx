// SuperadminDashboard.jsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, ClipboardList, CheckCircle, XCircle, Star, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/common/StatCard';
import PendingApprovalsCard from '../../components/common/PendingApprovalsCard';
import { formatDate } from '../../utils/helpers';
import { LEAVE_TYPE_LABEL } from '../../utils/leaveConstants';

export function SuperadminDashboard() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ['superadmin-dashboard'],
    queryFn: () => api.get('/superadmin/dashboard').then(r => r.data.data),
  });

  const { data: pendingLeaves } = useQuery({
    queryKey: ['sa-dashboard-pending-leaves'],
    queryFn: () => api.get('/superadmin/leaves/approvals?limit=3').then(r => r.data.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-signal-600 dark:text-signal-400 bg-signal-50 dark:bg-signal-400/10 border border-signal-200 dark:border-signal-400/20 rounded-full px-2.5 py-0.5 mb-2">
          <Star className="w-3 h-3" /> SP Command
        </span>
        <h1 className="text-2xl font-display font-bold text-ink-900 dark:text-white">SP Dashboard</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Overview of all operations under your command</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Admins" value={stats?.totalAdmins} color="blue" sub={`${stats?.activeAdmins ?? 0} active`} />
        <StatCard icon={Users} label="Total Officers" value={stats?.totalOfficers} color="green" />
        <StatCard icon={ClipboardList} label="Total Duties" value={stats?.totalDuties} color="purple" />
        <StatCard icon={ClipboardList} label="Active Duties" value={stats?.activeDuties} color="orange" />
        <StatCard icon={CheckCircle} label="Completed Duties" value={stats?.completedDuties} color="green" />
      </div>

      <PendingApprovalsCard
        title="Leave Requests"
        count={pendingLeaves?.pagination?.total ?? 0}
        items={pendingLeaves?.data ?? []}
        viewAllTo="/superadmin/leave"
        renderItem={lv => (
          <div
            key={lv._id}
            onClick={() => navigate('/superadmin/leave')}
            className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-ink-50 dark:hover:bg-white/[0.03] transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900 dark:text-white truncate">
                {lv.officerRef?.name || lv.applicantRef?.name}
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {LEAVE_TYPE_LABEL[lv.leaveType]} · {formatDate(lv.fromDate)} – {formatDate(lv.toDate)}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-300 shrink-0" />
          </div>
        )}
      />
    </div>
  );
}

export default SuperadminDashboard;