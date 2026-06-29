import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, RefreshCw, XCircle, FileText, MapPin, Clock, Phone,
  CheckCircle, Pencil, Users, Download, ExternalLink, Loader2,
  ClipboardCheck, AlertCircle, Lock, ArrowLeftRight, Check, X,
  History, ChevronDown, ChevronUp
} from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDateTime, getStatusColor, getPriorityColor, getPriorityLabel, getDutyTypeColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

// ─── Attendance status badge ──────────────────────────────────────────────────
function AttBadge({ status }) {
  const styles = {
    present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    absent:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels = { present: 'Present', partial: 'Checked In', absent: 'Absent' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.absent}`}>
      {labels[status] || 'Absent'}
    </span>
  );
}

// ─── Swap request status badge ────────────────────────────────────────────────
function SwapStatusBadge({ status }) {
  const map = {
    pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.pending}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}

// ─── Attendance panel ─────────────────────────────────────────────────────────
function AttendancePanel({ dutyId, duty }) {
  const [exporting, setExporting] = useState(false);

  const { data: attData, isLoading } = useQuery({
    queryKey: ['duty-attendance', dutyId],
    queryFn: () => api.get(`/attendance/duty/${dutyId}`).then(r => r.data.data),
  });

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const base = api.defaults.baseURL || '';
      const url = `${base}/attendance/duty/${dutyId}/export-pdf`;
      const win = window.open('about:blank', '_blank');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const html = await res.text();
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setExporting(false);
    }
  };

  const summary = attData?.summary || [];
  const stats   = attData?.stats   || {};

  const formatDur = (mins) => {
    if (!mins) return '—';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="section-title flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary-500" /> Attendance
        </h2>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium transition-colors disabled:opacity-60"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export PDF
        </button>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: stats.totalAssigned || 0, cls: 'bg-signal2-50 text-signal2-700 dark:bg-signal2-900/20 dark:text-signal2-400' },
            { label: 'Present', value: stats.present || 0, cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
            { label: 'Checked In', value: stats.partial || 0, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
            { label: 'Absent', value: stats.absent || 0, cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
          ].map(s => (
            <div key={s.label} className={`rounded-lg p-2.5 text-center ${s.cls}`}>
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-[11px] font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : summary.length === 0 ? (
        <p className="text-sm text-ink-400 text-center py-4">No assigned officers found</p>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-ink-50 dark:bg-ink-800/50">
              <tr>
                {['Officer', 'Rank', 'Check-In', 'Check-Out', 'Duration', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {summary.map((s, i) => (
                <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900 dark:text-white">{s.officer?.name || '—'}</p>
                    {s.officer?.badgeNumber && <p className="text-xs text-ink-400">#{s.officer.badgeNumber}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink-500 text-xs">{s.rank?.name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400 whitespace-nowrap">
                    {s.attendance?.checkedInAt ? formatDateTime(s.attendance.checkedInAt) : '—'}
                    {s.attendance?.checkInDistanceMeters != null && (
                      <p className="text-ink-400">{s.attendance.checkInDistanceMeters}m away</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400 whitespace-nowrap">
                    {s.attendance?.checkedOutAt ? formatDateTime(s.attendance.checkedOutAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400">
                    {formatDur(s.attendance?.durationMinutes)}
                  </td>
                  <td className="px-4 py-3">
                    <AttBadge status={s.attendanceStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Swap Requests Panel ──────────────────────────────────────────────────────
function SwapRequestsPanel({ dutyId, onSwapActioned }) {
  const qc = useQueryClient();
  const [actionTarget, setActionTarget] = useState(null); // { swap, action: 'accept'|'reject' }
  const [opNote, setOpNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { data: swapData, isLoading } = useQuery({
    queryKey: ['duty-swap-requests', dutyId],
    queryFn: () => api.get(`/operator/swaps/duty/${dutyId}`).then(r => r.data.data),
  });

  const pending  = swapData?.swapRequests?.filter(s => s.status === 'pending') || [];
  const history  = swapData?.swapRequests?.filter(s => s.status !== 'pending') || [];

  const acceptMut = useMutation({
    mutationFn: ({ swapId, note }) =>
      api.patch(`/operator/swaps/${swapId}/accept`, { operatorNote: note }),
    onSuccess: () => {
      toast.success('Swap accepted and executed!');
      qc.invalidateQueries(['duty-swap-requests', dutyId]);
      qc.invalidateQueries(['op-duty-detail', dutyId]);
      setActionTarget(null);
      setOpNote('');
      onSwapActioned?.();
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const rejectMut = useMutation({
    mutationFn: ({ swapId, note }) =>
      api.patch(`/operator/swaps/${swapId}/reject`, { operatorNote: note }),
    onSuccess: () => {
      toast.success('Swap request rejected.');
      qc.invalidateQueries(['duty-swap-requests', dutyId]);
      setActionTarget(null);
      setOpNote('');
      onSwapActioned?.();
    },
    onError: (err) => toast.error(apiError(err)),
  });

  if (isLoading) return (
    <div className="card p-5 flex justify-center py-8">
      <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  if (pending.length === 0 && history.length === 0) return null;

  return (
    <div className="card p-5 space-y-4">
      <h2 className="section-title flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4 text-purple-500" />
        Swap Requests
        {pending.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {pending.length} pending
          </span>
        )}
      </h2>

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="space-y-3">
          {pending.map(swap => (
            <div key={swap._id} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">
                      {swap.requestedBy?.name || '—'}
                    </span>
                    <SwapStatusBadge status={swap.status} />
                    {swap.assignment?.rankRef && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-semibold"
                        style={{ backgroundColor: swap.assignment.rankRef.color || '#6b7280' }}>
                        {swap.assignment.rankRef.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">
                    Reason: <span className="font-medium text-ink-700 dark:text-ink-300">{swap.requestReason}</span>
                  </p>
                  <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(swap.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setActionTarget({ swap, action: 'reject' }); setOpNote(''); }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-ink-800 border border-red-200 dark:border-red-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                  <button
                    onClick={() => { setActionTarget({ swap, action: 'accept' }); setOpNote(''); }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors"
                  >
                    <Check className="w-3 h-3" /> Accept
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History toggle */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 font-medium"
          >
            <History className="w-3.5 h-3.5" />
            {showHistory ? 'Hide' : 'Show'} swap history ({history.length})
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.map(swap => (
                <div key={swap._id} className="rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/40 p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ink-800 dark:text-ink-200">
                          {swap.requestedBy?.name || '—'}
                        </span>
                        <SwapStatusBadge status={swap.status} />
                      </div>
                      <p className="text-xs text-ink-400 mt-0.5">Reason: {swap.requestReason}</p>
                      {swap.status === 'accepted' && swap.replacedWith && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                          → Replaced with: {swap.replacedWith.name}
                        </p>
                      )}
                      {swap.operatorNote && (
                        <p className="text-xs text-ink-400 mt-0.5">Note: {swap.operatorNote}</p>
                      )}
                      <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(swap.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Accept modal */}
      <Modal
        isOpen={actionTarget?.action === 'accept'}
        onClose={() => { setActionTarget(null); setOpNote(''); }}
        title="Accept Swap Request"
        size="sm"
      >
        {actionTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm space-y-1.5">
              <p className="text-ink-600 dark:text-ink-400">
                Requesting officer:{' '}
                <span className="font-medium text-ink-900 dark:text-white">
                  {actionTarget.swap.fromOfficer?.name || actionTarget.swap.requestedBy?.name || '—'}
                </span>
              </p>
              <p className="text-ink-600 dark:text-ink-400">
                Swap with:{' '}
                <span className="font-medium text-ink-900 dark:text-white">
                  {actionTarget.swap.toOfficer?.name || '—'}
                  {actionTarget.swap.mode === 'swap' && actionTarget.swap.toOfficerCurrentDuty &&
                    <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                      (on {actionTarget.swap.toOfficerCurrentDuty.dutyName} — two-way swap)
                    </span>
                  }
                </span>
              </p>
              <p className="text-xs text-ink-400">Reason: {actionTarget.swap.requestReason}</p>
            </div>

            <div>
              <label className="form-label">Note to officers (optional)</label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="e.g. Report to same location, briefed already..."
                value={opNote}
                onChange={e => setOpNote(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setActionTarget(null); setOpNote(''); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => acceptMut.mutate({ swapId: actionTarget.swap._id, note: opNote })}
                disabled={acceptMut.isPending}
                className="btn-primary flex-1"
              >
                {acceptMut.isPending ? 'Processing...' : 'Accept & Execute Swap'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject modal */}
      <Modal
        isOpen={actionTarget?.action === 'reject'}
        onClose={() => { setActionTarget(null); setOpNote(''); }}
        title="Reject Swap Request"
        size="sm"
      >
        {actionTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm">
              <p className="text-ink-600 dark:text-ink-400">
                Officer: <span className="font-medium text-ink-900 dark:text-white">{actionTarget.swap.requestedBy?.name}</span>
              </p>
              <p className="text-xs text-ink-400 mt-0.5">Their reason: {actionTarget.swap.requestReason}</p>
            </div>
            <div>
              <label className="form-label">Reason for rejection (optional)</label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="e.g. No replacement available, critical post..."
                value={opNote}
                onChange={e => setOpNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setActionTarget(null); setOpNote(''); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => rejectMut.mutate({ swapId: actionTarget.swap._id, note: opNote })}
                disabled={rejectMut.isPending}
                className="btn-danger flex-1"
              >
                {rejectMut.isPending ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DutyDetail() {
  const { dutyId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancelDialog, setCancelDialog]   = useState(false);
  const [cancelReason, setCancelReason]   = useState('');
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [manualEditTarget, setManualEditTarget] = useState(null);
  const [manualPickId, setManualPickId]   = useState('');

  const { data: duty, isLoading } = useQuery({
    queryKey: ['op-duty-detail', dutyId],
    queryFn: () => api.get(`/operator/duties/${dutyId}`).then(r => r.data.data.duty),
  });

  const cancelMut = useMutation({
    mutationFn: (reason) => api.patch(`/operator/duties/${dutyId}/cancel`, { reason }),
    onSuccess: () => {
      toast.success('Duty cancelled');
      qc.invalidateQueries(['op-duty-detail', dutyId]);
      setCancelDialog(false);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const replaceMut = useMutation({
    mutationFn: (assignmentId) => api.patch(`/operator/duties/${dutyId}/replace/${assignmentId}`),
    onSuccess: (res) => {
      toast.success(`Replaced with ${res.data.data.replacement.name}`);
      qc.invalidateQueries(['op-duty-detail', dutyId]);
      setReplaceTarget(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const manualReplaceMut = useMutation({
    mutationFn: ({ assignmentId, officerId }) =>
      api.patch(`/operator/duties/${dutyId}/assignments/${assignmentId}/manual-replace`, { officerId }),
    onSuccess: (res) => {
      toast.success(`Officer changed to ${res.data.data.replacement.name}.`);
      qc.invalidateQueries(['op-duty-detail', dutyId]);
      setManualEditTarget(null);
      setManualPickId('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  // Operator-initiated swap on active duty (force swap without officer request)
  const operatorSwapMut = useMutation({
    mutationFn: ({ assignmentId, officerId }) =>
      api.post(`/operator/duties/${dutyId}/assignments/${assignmentId}/force-swap`, { toOfficerId: officerId, reason: 'Operator-initiated swap' }),
    onSuccess: (res) => {
      const mode = res.data.data.mode;
      toast.success(`Officer ${mode === 'swap' ? 'swapped with another duty' : 'moved'} successfully.`);
      qc.invalidateQueries(['op-duty-detail', dutyId]);
      qc.invalidateQueries(['duty-swap-requests', dutyId]);
      setManualEditTarget(null);
      setManualPickId('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  if (!duty) return <div className="text-center py-20 text-ink-400">Duty not found</div>;

  const activeOfficers   = duty.assignedOfficers?.filter(a => ['accepted', 'assigned'].includes(a.status)) || [];
  const rejectedOfficers = duty.assignedOfficers?.filter(a => a.status === 'rejected') || [];
  const dutyStarted      = new Date(duty.startDate) <= new Date();
  const isActiveDuty     = duty.status === 'active' && dutyStarted;
  // Pre-start edit (same as before)
  const canEditPreStart  = ['draft', 'active'].includes(duty.status) && !dutyStarted;
  // Operator can always swap officers on active ongoing duties too
  const canSwapActive    = isActiveDuty;
  const canEditOfficers  = canEditPreStart;
  const canCancel        = ['draft', 'active'].includes(duty.status) && !dutyStarted;

  const openMaps = () => {
    if (!duty.location?.lat || !duty.location?.lng) return;
    const { lat, lng } = duty.location;
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/operator/duties')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-primary-600">
        <ArrowLeft className="w-4 h-4" /> Back to Duties
      </button>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold font-display text-ink-900 dark:text-white">{duty.dutyName}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status.toUpperCase()}</span>
              <span className={`badge border ${getPriorityColor(duty.priority)}`}>{getPriorityLabel(duty.priority)}</span>
              {duty.dutyType && <span className={`badge ${getDutyTypeColor(duty.dutyType)}`}>{duty.dutyType}</span>}
              {duty.status === 'draft' && (
                <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Will go live automatically at start time
                </span>
              )}
              {isActiveDuty && (
                <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Duty in progress
                </span>
              )}
            </div>
          </div>
          {canCancel && (
            <button onClick={() => setCancelDialog(true)} className="btn-danger text-sm">
              <XCircle className="w-4 h-4" /> Cancel Duty
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-ink-400">Location</p>
              <p className="text-sm font-medium text-ink-800 dark:text-ink-200">{duty.locationName}</p>
              {duty.location?.lat && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-ink-400">{duty.location.lat}, {duty.location.lng}</p>
                  <button
                    onClick={openMaps}
                    className="flex items-center gap-1 text-xs text-signal2-600 dark:text-signal2-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Maps
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-ink-400">Duration</p>
              <p className="text-sm font-medium text-ink-800 dark:text-ink-200">{formatDateTime(duty.startDate)}</p>
              <p className="text-sm text-ink-500">to {formatDateTime(duty.endDate)}</p>
            </div>
          </div>
          {duty.phoneNumbers?.length > 0 && (
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-ink-400">Contact Numbers</p>
                {duty.phoneNumbers.map((ph, i) => (
                  <p key={i} className="text-sm font-medium text-ink-800 dark:text-ink-200">{ph}</p>
                ))}
              </div>
            </div>
          )}
          {duty.description && (
            <div className="sm:col-span-2 flex items-start gap-2">
              <FileText className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-ink-400">Description</p>
                <p className="text-sm text-ink-700 dark:text-ink-300">{duty.description}</p>
              </div>
            </div>
          )}
          {duty.vehicleNumber && (
            <div className="sm:col-span-2 flex items-start gap-2">
              <FileText className="w-4 h-4 text-ink-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-ink-400">Vehicle Number</p>
                <p className="text-sm text-ink-700 dark:text-ink-300">{duty.vehicleNumber}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Attendance Panel ── */}
      <AttendancePanel dutyId={dutyId} duty={duty} />

      {/* ── Swap Requests Panel (shown when duty is active) ── */}
      {isActiveDuty && (
        <SwapRequestsPanel
          dutyId={dutyId}
          onSwapActioned={() => qc.invalidateQueries(['op-duty-detail', dutyId])}
        />
      )}

      {/* Active Officers */}
      <div className="card p-5">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" /> Assigned Officers ({activeOfficers.length})
        </h2>

        {/* Active duty notice with swap capability */}
        {isActiveDuty && (
          <div className="mb-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
            <div className="flex items-start gap-2">
              <ArrowLeftRight className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
              <p className="text-sm text-purple-800 dark:text-purple-300">
                <span className="font-semibold">Duty is active.</span> You can swap any officer to another available officer at any time.
                Full swap history is tracked automatically.
              </p>
            </div>
          </div>
        )}

        {activeOfficers.length === 0 ? (
          <p className="text-sm text-ink-400">No active assignments</p>
        ) : (
          <div className="space-y-3">
            {activeOfficers.map(ao => (
              <div key={ao._id} className="flex items-center justify-between bg-ink-50 dark:bg-ink-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: ao.rankRef?.color || '#6b7280' }}
                  >
                    {ao.officerRef?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900 dark:text-white">{ao.officerRef?.name}</p>
                    <div className="flex items-center gap-1.5">
                      {ao.rankRef && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: ao.rankRef.color }}>
                          {ao.rankRef.code}
                        </span>
                      )}
                      <span className={`badge text-xs ${getStatusColor(ao.status)}`}>{ao.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-400">{ao.officerRef?.phone}</span>
                  {/* Pre-start edit */}
                  {canEditOfficers && (
                    <button
                      onClick={() => { setManualEditTarget({ ...ao, mode: 'prestart' }); setManualPickId(''); }}
                      className="btn-secondary text-xs px-2.5 py-1.5"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {/* Active duty force swap */}
                  {canSwapActive && (
                    <button
                      onClick={() => { setManualEditTarget({ ...ao, mode: 'active' }); setManualPickId(''); }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium transition-colors"
                    >
                      <ArrowLeftRight className="w-3 h-3" /> Swap
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejected Officers */}
      {rejectedOfficers.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4 flex items-center gap-2 text-red-600">
            <XCircle className="w-4 h-4" /> Rejected Assignments ({rejectedOfficers.length})
          </h2>
          <div className="space-y-3">
            {rejectedOfficers.map(ao => (
              <div key={ao._id} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-100 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                    {ao.officerRef?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900 dark:text-white">{ao.officerRef?.name}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Reason: {ao.rejectionReason}</p>
                  </div>
                </div>
                {canEditOfficers && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setManualEditTarget({ ...ao, mode: 'prestart' }); setManualPickId(''); }} className="btn-secondary text-xs px-3 py-1.5">
                      <Pencil className="w-3 h-3" /> Choose
                    </button>
                    <button onClick={() => setReplaceTarget(ao)} className="btn-primary text-xs px-3 py-1.5">
                      <RefreshCw className="w-3 h-3" /> Random
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      {duty.documents?.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-3">Documents</h2>
          <div className="space-y-2">
            {duty.documents.map((doc, i) => (
              <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
                <FileText className="w-4 h-4" /> {doc.originalName || `Document ${i + 1}`}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Timeline</h2>
        <div className="space-y-3">
          {duty.timeline?.map((event, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                {i < duty.timeline.length - 1 && <div className="w-0.5 flex-1 bg-ink-200 dark:bg-ink-700 mt-1" />}
              </div>
              <div className="pb-3">
                <p className="font-medium text-ink-800 dark:text-ink-200">{event.action?.replace(/_/g, ' ')}</p>
                {event.note && <p className="text-ink-500 dark:text-ink-400 text-xs">{event.note}</p>}
                <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(event.performedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel modal */}
      <Modal isOpen={cancelDialog} onClose={() => setCancelDialog(false)} title="Cancel Duty" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-400">All assigned officers will be notified via WhatsApp.</p>
          <div>
            <label className="form-label">Reason for cancellation</label>
            <textarea className="input-field" rows={3} placeholder="Enter reason..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCancelDialog(false)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => cancelMut.mutate(cancelReason)} disabled={cancelMut.isPending} className="btn-danger flex-1">
              {cancelMut.isPending ? 'Cancelling...' : 'Cancel Duty'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!replaceTarget}
        onClose={() => setReplaceTarget(null)}
        onConfirm={() => replaceMut.mutate(replaceTarget._id)}
        loading={replaceMut.isPending}
        title="Replace Officer"
        message={`Replace ${replaceTarget?.officerRef?.name} with a random available officer of the same rank?`}
        confirmLabel="Replace Randomly"
      />

      {/* Manual change / active swap modal */}
      <Modal
        isOpen={!!manualEditTarget}
        onClose={() => { setManualEditTarget(null); setManualPickId(''); }}
        title={manualEditTarget?.mode === 'active' ? 'Swap Officer (Active Duty)' : 'Change Officer'}
        size="sm"
      >
        {manualEditTarget && (
          <ManualOfficerSwap
            dutyId={dutyId}
            assignment={manualEditTarget}
            mode={manualEditTarget.mode}
            pickId={manualPickId}
            setPickId={setManualPickId}
            onCancel={() => { setManualEditTarget(null); setManualPickId(''); }}
            onConfirm={() => {
              if (manualEditTarget.mode === 'active') {
                operatorSwapMut.mutate({ assignmentId: manualEditTarget._id, officerId: manualPickId });
              } else {
                manualReplaceMut.mutate({ assignmentId: manualEditTarget._id, officerId: manualPickId });
              }
            }}
            loading={manualReplaceMut.isPending || operatorSwapMut.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

function ManualOfficerSwap({ dutyId, assignment, mode, pickId, setPickId, onCancel, onConfirm, loading }) {
  const rankId = assignment.rankRef?._id || assignment.rankRef;

  const { data: officers = [], isLoading } = useQuery({
    queryKey: ['op-available-officers-swap', rankId, dutyId],
    queryFn: () => api.get(`/operator/officers/available?rankId=${rankId}&excludeDutyId=${dutyId}`).then(r => r.data.data.officers),
    enabled: !!rankId,
  });

  const isActive = mode === 'active';

  return (
    <div className="space-y-4">
      {isActive && (
        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-2">
            <ArrowLeftRight className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <p className="text-sm text-purple-800 dark:text-purple-300">
              This swap will be logged with timestamp for full audit trail. The officer being removed will be notified.
            </p>
          </div>
        </div>
      )}
      <p className="text-sm text-ink-600 dark:text-ink-400">
        Currently assigned: <span className="font-medium text-ink-900 dark:text-white">{assignment.officerRef?.name}</span>
        {assignment.rankRef?.name && <> ({assignment.rankRef.name})</>}
      </p>
      {isLoading ? (
        <p className="text-sm text-ink-400">Loading available officers...</p>
      ) : officers.length === 0 ? (
        <p className="text-sm text-red-500">No other available officers of this rank right now.</p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {officers.map(o => (
            <label key={o._id} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg cursor-pointer border transition-colors ${pickId === o._id ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700' : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-700 hover:border-primary-300'}`}>
              <input type="radio" name="manual-swap" className="accent-primary-600" checked={pickId === o._id} onChange={() => setPickId(o._id)} />
              <span className="text-ink-800 dark:text-ink-200">{o.name}</span>
              {o.badgeNumber && <span className="text-xs text-ink-400 ml-auto">#{o.badgeNumber}</span>}
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!pickId || loading}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive ? 'bg-purple-600 text-white hover:bg-purple-700' : 'btn-primary'
          }`}
        >
          {loading
            ? 'Saving...'
            : isActive
            ? <><ArrowLeftRight className="w-4 h-4" /> Confirm Swap</>
            : 'Assign Officer'
          }
        </button>
      </div>
    </div>
  );
}