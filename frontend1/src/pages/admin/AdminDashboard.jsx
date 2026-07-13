import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, ClipboardList, CheckCircle, XCircle, Building2, FileEdit, ChevronRight, CalendarOff } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/common/StatCard';
import PendingApprovalsCard from '../../components/common/PendingApprovalsCard';
import { formatDate } from '../../utils/helpers';
import { LEAVE_TYPE_LABEL } from '../../utils/leaveConstants';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data),
  });

  // Latest 2–3 leave requests awaiting this admin's decision — surfaced here
  // so it isn't only visible after opening the Leave Management page.
  const { data: pendingLeaves } = useQuery({
    queryKey: ['admin-dashboard-pending-leaves'],
    queryFn: () => api.get('/admin/leaves/approvals?limit=3').then(r => r.data.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-signal2-600 dark:text-signal2-400 bg-signal2-50 dark:bg-signal2-400/10 border border-signal2-200 dark:border-signal2-400/20 rounded-full px-2.5 py-0.5 mb-2">
          <Building2 className="w-3 h-3" /> Admin Command
        </span>
        <h1 className="text-2xl font-display font-bold text-ink-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Your area operations overview</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Operators" value={stats?.operators} color="blue" />
        <StatCard icon={Users} label="Officers" value={stats?.officers} color="green" />
        <StatCard
          icon={CalendarOff} label="On Leave Today" value={stats?.officersOnLeave} color="yellow"
          onClick={() => navigate('/admin/officers?availability=on_leave')}
        />
        <StatCard icon={ClipboardList} label="Total Duties" value={stats?.totalDuties} color="purple" />
        <StatCard icon={FileEdit} label="Draft" value={stats?.draftDuties} color="yellow" />
        <StatCard icon={ClipboardList} label="Active Duties" value={stats?.activeDuties} color="orange" />
        <StatCard icon={CheckCircle} label="Completed" value={stats?.completedDuties} color="green" />
        <StatCard icon={XCircle} label="Cancelled" value={stats?.cancelledDuties} color="red" />
      </div>

      <PendingApprovalsCard
        title="Leave Requests"
        count={pendingLeaves?.pagination?.total ?? 0}
        items={pendingLeaves?.data ?? []}
        viewAllTo="/admin/leave"
        renderItem={lv => (
          <div
            key={lv._id}
            onClick={() => navigate('/admin/leave')}
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