import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ShieldAlert, Lock, Unlock, CalendarOff, Plus } from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDate, getStatusColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const LEAVE_TYPE_LABEL = {
  casual: 'Casual Leave', earned: 'Earned Leave', emergency: 'Emergency Leave',
  medical: 'Medical Leave', maternity: 'Maternity Leave', childcare: 'Child Care Leave',
};

export default function AdminLeaves() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [decideTarget, setDecideTarget] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);
  const [form, setForm] = useState({ leaveType: 'casual', fromDate: '', toDate: '', remark: '' });

  const { data: locks } = useQuery({
    queryKey: ['leave-locks'],
    queryFn: () => api.get('/admin/leaves/locks').then(r => r.data.data),
    refetchInterval: 60000,
  });

  const { data: approvals } = useQuery({
    queryKey: ['admin-leave-approvals'],
    queryFn: () => api.get('/admin/leaves/approvals?limit=20').then(r => r.data.data),
  });

  const { data: allLeaves, isLoading } = useQuery({
    queryKey: ['admin-all-leaves', page, statusFilter],
    queryFn: () => api.get(`/admin/leaves?page=${page}&limit=15${statusFilter ? `&status=${statusFilter}` : ''}`).then(r => r.data.data),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, decision, note }) => api.patch(`/admin/leaves/${id}/decide`, { decision, note }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === 'approve' ? 'Leave approved' : 'Leave rejected');
      qc.invalidateQueries({ queryKey: ['admin-leave-approvals'] });
      qc.invalidateQueries({ queryKey: ['admin-all-leaves'] });
      setDecideTarget(null); setDecisionNote('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const unlockMut = useMutation({
    mutationFn: (id) => api.patch(`/admin/leaves/locks/${id}/unlock`),
    onSuccess: () => { toast.success('Date unlocked'); qc.invalidateQueries({ queryKey: ['leave-locks'] }); },
    onError: (err) => toast.error(apiError(err)),
  });

  const applyMut = useMutation({
    mutationFn: (payload) => api.post('/admin/leaves', payload),
    onSuccess: () => { toast.success('Leave request submitted to Superadmin'); setApplyOpen(false); setForm({ leaveType: 'casual', fromDate: '', toDate: '', remark: '' }); },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">अवकाश प्रबंधन — Leave Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Approvals, staff leave overview &amp; threshold locks</p>
        </div>
        <button onClick={() => setApplyOpen(true)} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Apply My Own Leave</button>
      </div>

      {/* Threshold lock alert banner */}
      {locks?.locks?.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Leave threshold exceeded — new requests locked for these dates</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1">More than {locks.thresholdPercent}% of your officers are approved on leave on the day(s) below. Unlock a date to allow new leave requests covering it again.</p>
              <div className="mt-3 space-y-2">
                {locks.locks.map(l => (
                  <div key={l._id} className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800 dark:text-white">{l.date}</span>
                    <span className="text-xs text-gray-500">{l.onLeaveCount}/{l.totalOfficers} officers on leave ({l.percent.toFixed(1)}%)</span>
                    <button onClick={() => unlockMut.mutate(l._id)} disabled={unlockMut.isPending} className="btn-primary text-xs py-1 px-2">
                      <Unlock className="w-3 h-3" /> Unlock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approvals queue */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-800 dark:text-white text-sm">Pending Your Approval</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>{['Applicant', 'Type', 'Dates', 'Days', 'Note', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {approvals?.data?.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">Nothing pending</td></tr>
              ) : approvals?.data?.map(lv => (
                <tr key={lv._id} className="table-row">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {lv.officerRef?.name || lv.applicantRef?.name}
                    <span className="text-xs text-gray-400 ml-1">({lv.applicantRole === 'admin' ? 'Admin' : lv.rankTierAtRequest === 'junior' ? 'Officer' : 'SI/Insp/DSP'})</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{LEAVE_TYPE_LABEL[lv.leaveType]}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(lv.fromDate)} – {formatDate(lv.toDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{lv.totalDays}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate" title={lv.routingNote}>{lv.routingNote || '—'}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => setDecideTarget({ leave: lv, decision: 'approve' })} className="btn-primary text-xs py-1 px-2"><CheckCircle className="w-3 h-3" /> Approve</button>
                    <button onClick={() => setDecideTarget({ leave: lv, decision: 'reject' })} className="btn-danger text-xs py-1 px-2"><XCircle className="w-3 h-3" /> Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All leaves in hierarchy */}
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
                <tr key={lv._id} className="table-row">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{lv.officerRef?.name || lv.applicantRef?.name}</td>
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

      {/* Decide modal */}
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

      {/* Admin's own leave apply modal */}
      <Modal isOpen={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for Leave (goes to Superadmin)">
        <form onSubmit={(e) => { e.preventDefault(); applyMut.mutate(form); }} className="space-y-4">
          <div>
            <label className="form-label">Leave Type *</label>
            <select className="input-field" value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))}>
              <option value="casual">Casual Leave</option>
              <option value="earned">Earned (Paid) Leave</option>
              <option value="emergency">Emergency Leave</option>
              <option value="medical">Medical Leave</option>
              <option value="maternity">Maternity Leave</option>
              <option value="childcare">Child Care Leave</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">From *</label><input type="date" className="input-field" value={form.fromDate} onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))} required /></div>
            <div><label className="form-label">To *</label><input type="date" className="input-field" value={form.toDate} onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))} required /></div>
          </div>
          <div><label className="form-label">Remark (optional)</label><textarea className="input-field" rows={2} value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setApplyOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={applyMut.isPending} className="btn-primary flex-1">{applyMut.isPending ? 'Submitting...' : 'Submit Request'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}