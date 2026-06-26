import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ClipboardCheck, X, ExternalLink } from 'lucide-react';
import api from '../../api/axios';
import {
  formatDateTime, getStatusColor, getPriorityColor,
  getPriorityLabel, getDutyTypeColor
} from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';
import Modal from '../../components/common/Modal';

// ─── Attendance status badge ──────────────────────────────────────────────────
function AttBadge({ status }) {
  const styles = {
    present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    absent:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels = { present: 'Present', partial: 'Checked In', absent: 'Absent' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.absent}`}>
      {labels[status] || 'Absent'}
    </span>
  );
}

// ─── Attendance modal (read-only, no export for superadmin/admin) ─────────────
function AttendanceModal({ dutyId, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['duty-attendance-view', dutyId],
    queryFn: () => api.get(`/attendance/duty/${dutyId}`).then(r => r.data.data),
    enabled: !!dutyId,
  });

  const summary = data?.summary || [];
  const stats   = data?.stats   || {};
  const duty    = data?.duty    || {};

  const formatDur = (mins) => {
    if (!mins) return '—';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <Modal isOpen={!!dutyId} onClose={onClose} title="Attendance Details" size="lg">
      {isLoading ? (
        <div className="py-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Duty info */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white">{duty.dutyName}</p>
            <p className="text-gray-500 text-xs mt-0.5">{duty.locationName}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: stats.totalAssigned || 0, cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
              { label: 'Present', value: stats.present || 0, cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
              { label: 'Checked In', value: stats.partial || 0, cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
              { label: 'Absent', value: stats.absent || 0, cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg p-2 text-center ${s.cls}`}>
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] font-medium">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          {summary.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No assigned officers found</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    {['Officer', 'Rank', 'Check-In', 'Duration', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {summary.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{s.officer?.name || '—'}</p>
                        {s.officer?.phone && <p className="text-xs text-gray-400">{s.officer.phone}</p>}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{s.rank?.name || '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {s.attendance?.checkedInAt ? formatDateTime(s.attendance.checkedInAt) : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400">
                        {formatDur(s.attendance?.durationMinutes)}
                      </td>
                      <td className="px-3 py-3">
                        <AttBadge status={s.attendanceStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Shared duties table ──────────────────────────────────────────────────────
function DutiesTable({ queryKey, queryFn, showAdmin = false, showOperator = true }) {
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [attDutyId, setAttDutyId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, page, search, status],
    queryFn: () => queryFn({ page, search, status }),
  });

  const headers = [
    'Duty', 'Location',
    showAdmin && 'Admin',
    showOperator && 'Operator',
    'Priority', 'Type', 'Start', 'End', 'Officers', 'Status', 'Attendance'
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="Search duties..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input-field sm:w-40" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {headers.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={headers.length} className="py-10 text-center">
                  <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={headers.length} className="py-10 text-center text-gray-400 text-sm">No duties found</td></tr>
              ) : data?.data?.map(duty => (
                <tr key={duty._id} className="table-row">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[150px] truncate">{duty.dutyName}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{duty.locationName}</td>
                  {showAdmin && <td className="px-4 py-3 text-gray-500">{duty.adminRef?.name || '—'}</td>}
                  {showOperator && <td className="px-4 py-3 text-gray-500">{duty.operatorRef?.name || '—'}</td>}
                  <td className="px-4 py-3">
                    <span className={`badge border ${getPriorityColor(duty.priority)}`}>{getPriorityLabel(duty.priority)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {duty.dutyType ? <span className={`badge ${getDutyTypeColor(duty.dutyType)}`}>{duty.dutyType}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(duty.startDate)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(duty.endDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {duty.assignedOfficers?.filter(a => a.status !== 'replaced').length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setAttDutyId(duty._id)}
                      className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}
      </div>

      {attDutyId && (
        <AttendanceModal dutyId={attDutyId} onClose={() => setAttDutyId(null)} />
      )}
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export function SuperadminDuties() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Duties</h1>
      <DutiesTable
        queryKey={['superadmin-duties']}
        queryFn={({ page, search, status }) =>
          api.get(`/superadmin/duties?page=${page}&search=${search}&status=${status}`).then(r => r.data.data)
        }
        showAdmin={true}
      />
    </div>
  );
}

export function AdminDuties() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Duties</h1>
      <DutiesTable
        queryKey={['admin-duties']}
        queryFn={({ page, search, status }) =>
          api.get(`/admin/duties?page=${page}&search=${search}&status=${status}`).then(r => r.data.data)
        }
      />
    </div>
  );
}

export default SuperadminDuties;