import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, CalendarOff, Clock, CheckCircle, XCircle, FileText, Upload,
  ShieldCheck, Users, Building2, X, AlertTriangle,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { apiError, formatDate, getStatusColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual Leave', category: 'regular' },
  { value: 'earned', label: 'Earned (Paid) Leave', category: 'regular' },
  { value: 'emergency', label: 'Emergency Leave', category: 'special' },
  { value: 'medical', label: 'Medical Leave', category: 'special' },
  { value: 'maternity', label: 'Maternity Leave', category: 'special' },
  { value: 'childcare', label: 'Child Care Leave', category: 'special' },
];
const LEAVE_TYPE_LABEL = Object.fromEntries(LEAVE_TYPES.map(t => [t.value, t.label]));
const APPROVER_LABEL = { inspector: 'Inspector (Thana)', dsp: 'DSP (Zone)', admin: 'Admin', superadmin: 'Superadmin' };

const EMPTY_FORM = { leaveType: 'casual', fromDate: '', toDate: '', remark: '' };

export default function OfficerLeaves() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [document, setDocument] = useState(null);
  const [page, setPage] = useState(1);
  const [decideTarget, setDecideTarget] = useState(null); // { leave, decision }
  const [decisionNote, setDecisionNote] = useState('');

  const isInspector = user?.rankRef?.leaveApprovalRole === 'inspector';
  const isDSP = user?.rankRef?.leaveApprovalRole === 'dsp';
  const isApprover = isInspector || isDSP;

  const { data: balance } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/officer/leaves/balance').then(r => r.data.data),
  });

  const { data: myLeaves, isLoading } = useQuery({
    queryKey: ['my-leaves', page],
    queryFn: () => api.get(`/officer/leaves?page=${page}&limit=10`).then(r => r.data.data),
  });

  const { data: approvals } = useQuery({
    queryKey: ['leave-approvals'],
    queryFn: () => api.get('/officer/leaves/approvals?limit=20').then(r => r.data.data),
    enabled: isApprover,
  });

  const { data: overview } = useQuery({
    queryKey: ['leave-overview', isInspector ? 'thana' : 'zone'],
    queryFn: () => api.get(isInspector ? '/officer/leaves/thana-overview?limit=20' : '/officer/leaves/zone-overview?limit=20').then(r => r.data.data),
    enabled: isApprover,
  });

  const applyMut = useMutation({
    mutationFn: (fd) => api.post('/officer/leaves', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Leave request submitted');
      qc.invalidateQueries({ queryKey: ['my-leaves'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setApplyOpen(false); setForm(EMPTY_FORM); setDocument(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const cancelMut = useMutation({
    mutationFn: (id) => api.patch(`/officer/leaves/${id}/cancel`),
    onSuccess: () => { toast.success('Leave cancelled'); qc.invalidateQueries({ queryKey: ['my-leaves'] }); qc.invalidateQueries({ queryKey: ['leave-balance'] }); },
    onError: (err) => toast.error(apiError(err)),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, decision, note }) => api.patch(`/officer/leaves/${id}/decide`, { decision, note }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === 'approve' ? 'Leave approved' : 'Leave rejected');
      qc.invalidateQueries({ queryKey: ['leave-approvals'] });
      qc.invalidateQueries({ queryKey: ['leave-overview'] });
      setDecideTarget(null); setDecisionNote('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const handleApply = (e) => {
    e.preventDefault();
    if (!form.fromDate || !form.toDate) { toast.error('Select from/to dates'); return; }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (document) fd.append('document', document);
    applyMut.mutate(fd);
  };

  const selectedType = LEAVE_TYPES.find(t => t.value === form.leaveType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">अवकाश प्रबंधन — Leave</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Apply for leave and track your requests</p>
        </div>
        <button onClick={() => setApplyOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Apply for Leave
        </button>
      </div>

      {/* Balance cards */}
      {balance && (
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Casual Leave</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{balance.casual.remaining}<span className="text-sm text-gray-400 font-normal"> / {balance.casual.allocated} days left</span></p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Earned Leave</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{balance.earned.remaining}<span className="text-sm text-gray-400 font-normal"> / {balance.earned.allocated} days left</span></p>
          </div>
        </div>
      )}

      {/* My leave requests */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-800 dark:text-white text-sm">My Leave Requests</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Type', 'Dates', 'Days', 'Goes To', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={6} className="py-10 text-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></td></tr>
              ) : myLeaves?.data?.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400 text-sm">
                  <CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-30" /> No leave requests yet
                </td></tr>
              ) : myLeaves?.data?.map(lv => (
                <tr key={lv._id} className="table-row">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{LEAVE_TYPE_LABEL[lv.leaveType]}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(lv.fromDate)} – {formatDate(lv.toDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{lv.totalDays}</td>
                  <td className="px-4 py-3 text-gray-500">{APPROVER_LABEL[lv.approverLevel]}</td>
                  <td className="px-4 py-3"><span className={`badge ${getStatusColor(lv.status)}`}>{lv.status}</span></td>
                  <td className="px-4 py-3">
                    {['pending', 'approved'].includes(lv.status) && (
                      <button onClick={() => cancelMut.mutate(lv._id)} className="text-xs text-red-500 hover:underline">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {myLeaves?.pagination && <Pagination pagination={myLeaves.pagination} onPageChange={setPage} />}
      </div>

      {/* Approvals — Inspector/DSP only */}
      {isApprover && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-500" /> Pending Approvals ({isInspector ? 'Thana' : 'Zone'})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Officer', 'Type', 'Dates', 'Days', 'Remark', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {approvals?.data?.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">Nothing pending</td></tr>
                ) : approvals?.data?.map(lv => (
                  <tr key={lv._id} className="table-row">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {lv.officerRef?.name}
                      {lv.officerRef?.badgeNumber && <span className="text-xs text-gray-400 ml-1">#{lv.officerRef.badgeNumber}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{LEAVE_TYPE_LABEL[lv.leaveType]}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(lv.fromDate)} – {formatDate(lv.toDate)}</td>
                    <td className="px-4 py-3 text-gray-500">{lv.totalDays}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate" title={lv.remark}>{lv.remark || '—'}</td>
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
      )}

      {/* Thana / Zone overview — Inspector/DSP only */}
      {isApprover && overview && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
            {isInspector ? <Building2 className="w-4 h-4 text-primary-500" /> : <Users className="w-4 h-4 text-primary-500" />}
            {isInspector ? `Thana Leave Overview — ${overview.thana}` : `Zone Leave Overview — ${overview.zone}`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Officer', 'Type', 'Dates', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {overview.data?.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">No leave activity</td></tr>
                ) : overview.data?.map(lv => (
                  <tr key={lv._id} className="table-row">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{lv.officerRef?.name}</td>
                    <td className="px-4 py-3 text-gray-500">{LEAVE_TYPE_LABEL[lv.leaveType]}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(lv.fromDate)} – {formatDate(lv.toDate)}</td>
                    <td className="px-4 py-3"><span className={`badge ${getStatusColor(lv.status)}`}>{lv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDSP && overview.balanceSummary && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Zone Balance Summary</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {overview.balanceSummary.map(b => (
                  <div key={b.officerId} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{b.name}</span>
                    <span className="text-gray-400 whitespace-nowrap ml-2">CL {b.casualRemaining} · EL {b.earnedRemaining}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Apply Modal */}
      <Modal isOpen={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for Leave">
        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="form-label">Leave Type *</label>
            <select className="input-field" value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">From *</label><input type="date" className="input-field" value={form.fromDate} onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))} required /></div>
            <div><label className="form-label">To *</label><input type="date" className="input-field" value={form.toDate} onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))} required /></div>
          </div>
          <div>
            <label className="form-label">Remark (optional)</label>
            <textarea className="input-field" rows={2} value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} placeholder="Reason for leave..." />
          </div>
          <div>
            <label className="form-label">Supporting Document (optional)</label>
            <div className="flex items-center gap-2">
              <label className="btn-secondary text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {document ? document.name : 'Choose file'}
                <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" onChange={e => setDocument(e.target.files[0])} />
              </label>
              {document && <button type="button" onClick={() => setDocument(null)} className="text-xs text-red-500"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <p className="text-xs text-gray-400 mt-1">e.g. medical certificate — image, PDF or Word file</p>
          </div>
          {selectedType?.category === 'special' && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Special leave requests go directly to the Superadmin for approval.
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setApplyOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={applyMut.isPending} className="btn-primary flex-1">{applyMut.isPending ? 'Submitting...' : 'Submit Request'}</button>
          </div>
        </form>
      </Modal>

      {/* Decide Modal */}
      <Modal isOpen={!!decideTarget} onClose={() => { setDecideTarget(null); setDecisionNote(''); }} title={decideTarget?.decision === 'approve' ? 'Approve Leave' : 'Reject Leave'}>
        {decideTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {decideTarget.leave.officerRef?.name} — {LEAVE_TYPE_LABEL[decideTarget.leave.leaveType]}, {decideTarget.leave.totalDays} day(s)
              ({formatDate(decideTarget.leave.fromDate)} – {formatDate(decideTarget.leave.toDate)})
            </p>
            <div>
              <label className="form-label">Note (optional)</label>
              <textarea className="input-field" rows={2} value={decisionNote} onChange={e => setDecisionNote(e.target.value)} />
            </div>
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
    </div>
  );
}