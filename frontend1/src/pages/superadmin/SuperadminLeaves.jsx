import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ShieldAlert, CalendarOff, Eye } from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDate, getStatusColor, getLeaveRowClass, LEAVE_STATUS_LEGEND } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import LeaveDetailModal from '../../components/leave/LeaveDetailModal';
import StatusLegend from '../../components/common/StatusLegend';
import { LEAVE_TYPE_LABEL } from '../../utils/leaveConstants';
import toast from 'react-hot-toast';

export default function SuperadminLeaves() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [approvalsPage, setApprovalsPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [decideTarget, setDecideTarget] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [viewTarget, setViewTarget] = useState(null); // { leave, actionable }
  const [viewNote, setViewNote] = useState('');

  const { data: locks } = useQuery({
    queryKey: ['sa-leave-locks'],
    queryFn: () => api.get('/superadmin/leaves/locks').then(r => r.data.data),
    refetchInterval: 60000,
  });

  const { data: approvals } = useQuery({
    queryKey: ['sa-leave-approvals', approvalsPage],
    queryFn: () => api.get(`/superadmin/leaves/approvals?limit=10&page=${approvalsPage}`).then(r => r.data.data),
  });

  const { data: allLeaves, isLoading } = useQuery({
    queryKey: ['sa-all-leaves', page, statusFilter],
    queryFn: () => api.get(`/superadmin/leaves?page=${page}&limit=15${statusFilter ? `&status=${statusFilter}` : ''}`).then(r => r.data.data),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, decision, note }) => api.patch(`/superadmin/leaves/${id}/decide`, { decision, note }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === 'approve' ? 'Leave approved' : 'Leave rejected');
      qc.invalidateQueries({ queryKey: ['sa-leave-approvals'] });
      qc.invalidateQueries({ queryKey: ['sa-all-leaves'] });
      setDecideTarget(null); setDecisionNote('');
      setViewTarget(null); setViewNote('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const openView = (leave, actionable = false) => setViewTarget({ leave, actionable });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">अवकाश प्रबंधन — Leave Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Special leave &amp; admin leave approvals across your hierarchy</p>
      </div>

      {locks?.locks?.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Leave threshold exceeded in your hierarchy</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1">More than {locks.thresholdPercent}% of officers are on approved leave on these dates. Only the relevant admin can unlock them.</p>
              <div className="mt-3 space-y-2">
                {locks.locks.map(l => (
                  <div key={l._id} className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800 dark:text-white">{l.date} <span className="text-xs text-gray-400 font-normal">({l.adminName})</span></span>
                    <span className="text-xs text-gray-500">{l.onLeaveCount}/{l.totalOfficers} on leave ({l.percent.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-800 dark:text-white text-sm">Pending Your Approval</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>{['Applicant', 'Type', 'Dates', 'Days', 'Remark', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {approvals?.data?.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">Nothing pending</td></tr>
              ) : approvals?.data?.map(lv => (
                <tr key={lv._id} onClick={() => openView(lv, true)} className="table-row cursor-pointer">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {lv.officerRef?.name || lv.applicantRef?.name}
                    <span className="text-xs text-gray-400 ml-1">({lv.applicantRole === 'admin' ? 'Admin' : 'Officer'})</span>
                    {lv.document?.url && <Eye className="inline-block w-3 h-3 text-signal2-500 ml-1.5 align-text-top" aria-label="Has attachment" />}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{LEAVE_TYPE_LABEL[lv.leaveType]}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(lv.fromDate)} – {formatDate(lv.toDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{lv.totalDays}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate" title={lv.remark}>{lv.remark || '—'}</td>
                  <td className="px-4 py-3 flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDecideTarget({ leave: lv, decision: 'approve' })} className="btn-primary text-xs py-1 px-2"><CheckCircle className="w-3 h-3" /> Approve</button>
                    <button onClick={() => setDecideTarget({ leave: lv, decision: 'reject' })} className="btn-danger text-xs py-1 px-2"><XCircle className="w-3 h-3" /> Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {approvals?.pagination && <Pagination pagination={approvals.pagination} onPageChange={setApprovalsPage} />}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="font-semibold text-gray-800 dark:text-white text-sm">All Leave Requests</span>
          <select className="input-field !w-40 !py-1.5 text-xs" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <StatusLegend items={LEAVE_STATUS_LEGEND} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>{['Applicant', 'Type', 'Dates', 'Days', 'Goes To', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={6} className="py-10 text-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></td></tr>
              ) : allLeaves?.data?.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400 text-sm"><CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-30" /> No leave requests</td></tr>
              ) : allLeaves?.data?.map(lv => (
                <tr key={lv._id} onClick={() => openView(lv, false)} className={`table-row cursor-pointer ${getLeaveRowClass(lv.status)}`}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {lv.officerRef?.name || lv.applicantRef?.name}
                    {lv.document?.url && <Eye className="inline-block w-3 h-3 text-signal2-500 ml-1.5 align-text-top" aria-label="Has attachment" />}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{LEAVE_TYPE_LABEL[lv.leaveType]}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(lv.fromDate)} – {formatDate(lv.toDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{lv.totalDays}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{lv.approverLevel}</td>
                  <td className="px-4 py-3"><span className={`badge ${getStatusColor(lv.status)}`}>{lv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allLeaves?.pagination && <Pagination pagination={allLeaves.pagination} onPageChange={setPage} />}
      </div>

      <Modal isOpen={!!decideTarget} onClose={() => { setDecideTarget(null); setDecisionNote(''); }} title={decideTarget?.decision === 'approve' ? 'Approve Leave' : 'Reject Leave'}>
        {decideTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {decideTarget.leave.officerRef?.name || decideTarget.leave.applicantRef?.name} — {LEAVE_TYPE_LABEL[decideTarget.leave.leaveType]}, {decideTarget.leave.totalDays} day(s)
            </p>
            <div><label className="form-label">Note (optional)</label><textarea className="input-field" rows={2} value={decisionNote} onChange={e => setDecisionNote(e.target.value)} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setDecideTarget(null); setDecisionNote(''); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => decideMut.mutate({ id: decideTarget.leave._id, decision: decideTarget.decision, note: decisionNote })}
                disabled={decideMut.isPending}
                className={decideTarget.decision === 'approve' ? 'btn-primary flex-1' : 'btn-danger flex-1'}
              >
                {decideMut.isPending ? 'Saving...' : decideTarget.decision === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Full detail view — opened by clicking any row in either table above */}
      <LeaveDetailModal
        isOpen={!!viewTarget}
        onClose={() => { setViewTarget(null); setViewNote(''); }}
        leave={viewTarget?.leave}
        actionable={viewTarget?.actionable}
        decisionNote={viewNote}
        onDecisionNoteChange={setViewNote}
        decisionPending={decideMut.isPending}
        onApprove={() => decideMut.mutate({ id: viewTarget.leave._id, decision: 'approve', note: viewNote })}
        onReject={() => decideMut.mutate({ id: viewTarget.leave._id, decision: 'reject', note: viewNote })}
      />
    </div>
  );
}