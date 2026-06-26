import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, RefreshCw, XCircle, FileText, MapPin, Clock, Phone,
  CheckCircle, Pencil, Users, Download, ExternalLink, Loader2,
  ClipboardCheck, AlertCircle, Lock
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
      // Open the backend's print-ready HTML in a new tab — browser handles PDF save
      const token = localStorage.getItem('accessToken');
      const base = api.defaults.baseURL || '';
      const url = `${base}/attendance/duty/${dutyId}/export-pdf`;
      const win = window.open('about:blank', '_blank');
      // Fetch with auth header then write into new window
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
      {/* Header + Export */}
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

      {/* Stats row */}
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

      {/* Table */}
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

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  if (!duty) return <div className="text-center py-20 text-ink-400">Duty not found</div>;

  const activeOfficers   = duty.assignedOfficers?.filter(a => ['accepted', 'assigned'].includes(a.status)) || [];
  const rejectedOfficers = duty.assignedOfficers?.filter(a => a.status === 'rejected') || [];
  const dutyStarted      = new Date(duty.startDate) <= new Date();
  // Draft duties haven't started yet (cron flips them to active automatically
  // at startDate), so officers can still be edited on a draft exactly like on
  // an active-but-not-yet-started duty.
  const canEditOfficers  = ['draft', 'active'].includes(duty.status) && !dutyStarted;
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
              {dutyStarted && duty.status === 'active' && (
                <span className="badge bg-signal-100 text-signal-700 dark:bg-signal-400/10 dark:text-signal-400 inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Duty in progress — locked
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

      {/* Active Officers */}
      <div className="card p-5">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" /> Assigned Officers ({activeOfficers.length})
        </h2>
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
                  {canEditOfficers && (
                    <button
                      onClick={() => { setManualEditTarget(ao); setManualPickId(''); }}
                      className="btn-secondary text-xs px-2.5 py-1.5"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!canEditOfficers && duty.status === 'active' && (
          <p className="text-xs text-ink-400 mt-3 flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> This duty has started, so officers can no longer be edited.
          </p>
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
                    <button onClick={() => { setManualEditTarget(ao); setManualPickId(''); }} className="btn-secondary text-xs px-3 py-1.5">
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

      {/* Modals */}
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

      <Modal isOpen={!!manualEditTarget} onClose={() => { setManualEditTarget(null); setManualPickId(''); }} title="Change Officer" size="sm">
        {manualEditTarget && (
          <ManualOfficerSwap
            dutyId={dutyId}
            assignment={manualEditTarget}
            pickId={manualPickId}
            setPickId={setManualPickId}
            onCancel={() => { setManualEditTarget(null); setManualPickId(''); }}
            onConfirm={() => manualReplaceMut.mutate({ assignmentId: manualEditTarget._id, officerId: manualPickId })}
            loading={manualReplaceMut.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

function ManualOfficerSwap({ dutyId, assignment, pickId, setPickId, onCancel, onConfirm, loading }) {
  const rankId = assignment.rankRef?._id || assignment.rankRef;

  const { data: officers = [], isLoading } = useQuery({
    queryKey: ['op-available-officers-swap', rankId, dutyId],
    queryFn: () => api.get(`/operator/officers/available?rankId=${rankId}&excludeDutyId=${dutyId}`).then(r => r.data.data.officers),
    enabled: !!rankId,
  });

  return (
    <div className="space-y-4">
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
        <button type="button" onClick={onConfirm} disabled={!pickId || loading} className="btn-primary flex-1">
          {loading ? 'Saving...' : 'Assign Officer'}
        </button>
      </div>
    </div>
  );
}