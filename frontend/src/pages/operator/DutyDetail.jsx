import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, XCircle, FileText, MapPin, Clock, Phone, User, CheckCircle, Pencil } from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDateTime, getStatusColor, getPriorityColor, getPriorityLabel, getDutyTypeColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

export default function DutyDetail() {
  const { dutyId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [manualEditTarget, setManualEditTarget] = useState(null); // assignment being manually changed
  const [manualPickId, setManualPickId] = useState('');

  const { data: duty, isLoading } = useQuery({
    queryKey: ['op-duty-detail', dutyId],
    queryFn: () => api.get(`/operator/duties/${dutyId}`).then(r => r.data.data.duty),
  });

  const cancelMut = useMutation({
    mutationFn: (reason) => api.patch(`/operator/duties/${dutyId}/cancel`, { reason }),
    onSuccess: () => {
      toast.success('Duty cancelled'); qc.invalidateQueries(['op-duty-detail', dutyId]);
      setCancelDialog(false);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const replaceMut = useMutation({
    mutationFn: (assignmentId) => api.patch(`/operator/duties/${dutyId}/replace/${assignmentId}`),
    onSuccess: (res) => {
      toast.success(`Replaced with ${res.data.data.replacement.name}`);
      qc.invalidateQueries(['op-duty-detail', dutyId]); setReplaceTarget(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const manualReplaceMut = useMutation({
    mutationFn: ({ assignmentId, officerId }) =>
      api.patch(`/operator/duties/${dutyId}/assignments/${assignmentId}/manual-replace`, { officerId }),
    onSuccess: (res) => {
      toast.success(`Officer changed to ${res.data.data.replacement.name}. They've been notified.`);
      qc.invalidateQueries(['op-duty-detail', dutyId]);
      setManualEditTarget(null); setManualPickId('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  if (!duty) return <div className="text-center py-20 text-gray-400">Duty not found</div>;

  const activeOfficers = duty.assignedOfficers?.filter(a => ['accepted', 'assigned'].includes(a.status)) || [];
  const rejectedOfficers = duty.assignedOfficers?.filter(a => a.status === 'rejected') || [];

  // Once the duty's start time has passed, officers can no longer be changed —
  // editing (manual swap) and replace are both hidden from this point on.
  const dutyStarted = new Date(duty.startDate) <= new Date();
  const canEditOfficers = duty.status === 'active' && !dutyStarted;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/operator/duties')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600">
        <ArrowLeft className="w-4 h-4" /> Back to Duties
      </button>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{duty.dutyName}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status.toUpperCase()}</span>
              <span className={`badge border ${getPriorityColor(duty.priority)}`}>{getPriorityLabel(duty.priority)}</span>
              {duty.dutyType && <span className={`badge ${getDutyTypeColor(duty.dutyType)}`}>{duty.dutyType}</span>}
              {dutyStarted && duty.status === 'active' && (
                <span className="badge bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Officers locked — duty started</span>
              )}
            </div>
          </div>
          {duty.status === 'active' && (
            <button onClick={() => setCancelDialog(true)} className="btn-danger text-sm">
              <XCircle className="w-4 h-4" /> Cancel Duty
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Location</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{duty.locationName}</p>
              <p className="text-xs text-gray-400">{duty.location?.lat}, {duty.location?.lng}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Duration</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDateTime(duty.startDate)}</p>
              <p className="text-sm text-gray-500">to {formatDateTime(duty.endDate)}</p>
            </div>
          </div>
          {duty.phoneNumbers?.length > 0 && (
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Contact Numbers</p>
                {duty.phoneNumbers.map((ph, i) => <p key={i} className="text-sm font-medium text-gray-800 dark:text-gray-200">{ph}</p>)}
              </div>
            </div>
          )}
          {duty.description && (
            <div className="sm:col-span-2 flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Description</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{duty.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Officers */}
      <div className="card p-5">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" /> Assigned Officers ({activeOfficers.length})
        </h2>
        {activeOfficers.length === 0 ? (
          <p className="text-sm text-gray-400">No active assignments</p>
        ) : (
          <div className="space-y-3">
            {activeOfficers.map(ao => (
              <div key={ao._id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: ao.rankRef?.color || '#6b7280' }}>
                    {ao.officerRef?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{ao.officerRef?.name}</p>
                    <div className="flex items-center gap-1.5">
                      {ao.rankRef && <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: ao.rankRef.color }}>{ao.rankRef.code}</span>}
                      <span className={`badge text-xs ${getStatusColor(ao.status)}`}>{ao.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{ao.officerRef?.phone}</span>
                  {canEditOfficers && (
                    <button
                      onClick={() => { setManualEditTarget(ao); setManualPickId(''); }}
                      className="btn-secondary text-xs px-2.5 py-1.5"
                      title="Change officer"
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
          <p className="text-xs text-gray-400 mt-3">This duty has started, so officers can no longer be edited.</p>
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
                  <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-sm">
                    {ao.officerRef?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{ao.officerRef?.name}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Reason: {ao.rejectionReason}</p>
                  </div>
                </div>
                {canEditOfficers && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setManualEditTarget(ao); setManualPickId(''); }} className="btn-secondary text-xs px-3 py-1.5">
                      <Pencil className="w-3 h-3" /> Choose Officer
                    </button>
                    <button onClick={() => setReplaceTarget(ao)} className="btn-primary text-xs px-3 py-1.5">
                      <RefreshCw className="w-3 h-3" /> Random
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!canEditOfficers && (
            <p className="text-xs text-gray-400 mt-3">This duty has started, so rejected assignments can no longer be replaced.</p>
          )}
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
                {i < duty.timeline.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />}
              </div>
              <div className="pb-3">
                <p className="font-medium text-gray-800 dark:text-gray-200">{event.action?.replace(/_/g, ' ')}</p>
                {event.note && <p className="text-gray-500 dark:text-gray-400 text-xs">{event.note}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(event.performedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Dialog */}
      <Modal isOpen={cancelDialog} onClose={() => setCancelDialog(false)} title="Cancel Duty" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">All assigned officers will be notified via WhatsApp and push notification.</p>
          <div><label className="form-label">Reason for cancellation</label><textarea className="input-field" rows={3} placeholder="Enter reason..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} /></div>
          <div className="flex gap-3">
            <button onClick={() => setCancelDialog(false)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => cancelMut.mutate(cancelReason)} disabled={cancelMut.isPending} className="btn-danger flex-1">{cancelMut.isPending ? 'Cancelling...' : 'Cancel Duty'}</button>
          </div>
        </div>
      </Modal>

      {/* Replace confirm (random) */}
      <ConfirmDialog
        isOpen={!!replaceTarget}
        onClose={() => setReplaceTarget(null)}
        onConfirm={() => replaceMut.mutate(replaceTarget._id)}
        loading={replaceMut.isPending}
        title="Replace Officer"
        message={`Replace ${replaceTarget?.officerRef?.name} with a random available officer of the same rank?`}
        confirmLabel="Replace Randomly"
      />

      {/* Manual officer change modal */}
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

// Lets the operator pick a specific replacement officer (instead of a random
// one) for any active or rejected assignment, as long as the duty hasn't
// started yet. Only shows officers of the same rank who are actually free.
function ManualOfficerSwap({ dutyId, assignment, pickId, setPickId, onCancel, onConfirm, loading }) {
  const rankId = assignment.rankRef?._id || assignment.rankRef;

  const { data: officers = [], isLoading } = useQuery({
    queryKey: ['op-available-officers-swap', rankId, dutyId],
    queryFn: () => api.get(`/operator/officers/available?rankId=${rankId}&excludeDutyId=${dutyId}`).then(r => r.data.data.officers),
    enabled: !!rankId,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Currently assigned: <span className="font-medium text-gray-900 dark:text-white">{assignment.officerRef?.name}</span>
        {assignment.rankRef?.name && <> ({assignment.rankRef.name})</>}
      </p>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading available officers...</p>
      ) : officers.length === 0 ? (
        <p className="text-sm text-red-500">No other available officers of this rank right now.</p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {officers.map(o => (
            <label key={o._id} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg cursor-pointer border transition-colors ${pickId === o._id ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}>
              <input type="radio" name="manual-swap" className="accent-primary-600" checked={pickId === o._id} onChange={() => setPickId(o._id)} />
              <span className="text-gray-800 dark:text-gray-200">{o.name}</span>
              {o.badgeNumber && <span className="text-xs text-gray-400 ml-auto">#{o.badgeNumber}</span>}
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