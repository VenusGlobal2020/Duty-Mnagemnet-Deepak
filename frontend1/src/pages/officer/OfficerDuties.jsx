import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, XCircle, MapPin, Clock, AlertCircle,
  Navigation, LogIn, LogOut, CheckCircle, Loader2, ExternalLink, Lock
} from 'lucide-react';
import api from '../../api/axios';
import {
  formatDateTime, getPriorityLabel, getPriorityColor,
  getStatusColor, apiError
} from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

// ─── Attendance badge helper ──────────────────────────────────────────────────
function AttBadge({ status }) {
  const map = {
    present:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    absent:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels = { present: 'Present', partial: 'Checked In', absent: 'Absent' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.absent}`}>
      {status === 'present' && <CheckCircle className="w-3 h-3" />}
      {labels[status] || 'Absent'}
    </span>
  );
}

// ─── Single duty card ─────────────────────────────────────────────────────────
function DutyCard({ duty }) {
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason]         = useState('');
  const [locLoading, setLocLoading] = useState(false);

  // fetch my attendance for this duty
  const { data: attData, isLoading: attLoading } = useQuery({
    queryKey: ['officer-att', duty._id],
    queryFn: () => api.get(`/attendance/my/${duty._id}`).then(r => r.data.data),
  });

  const hasCheckedIn  = attData?.hasCheckedIn;
  const hasCheckedOut = attData?.hasCheckedOut;
  const att           = attData?.attendance;

  const rejectMut = useMutation({
    mutationFn: ({ dutyId, reason }) => api.patch(`/officer/duties/${dutyId}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Duty rejected. Operator has been notified.');
      qc.invalidateQueries(['officer-active']);
      setRejectOpen(false);
      setReason('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const checkInMut = useMutation({
    mutationFn: ({ dutyId, lat, lng }) => api.post('/attendance/checkin', { dutyId, lat, lng }),
    onSuccess: () => {
      toast.success('Check-in successful!');
      qc.invalidateQueries(['officer-att', duty._id]);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const checkOutMut = useMutation({
    mutationFn: ({ dutyId, lat, lng }) => api.post('/attendance/checkout', { dutyId, lat, lng }),
    onSuccess: () => {
      toast.success('Check-out successful!');
      qc.invalidateQueries(['officer-att', duty._id]);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const getLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported on this device'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(new Error(err.message || 'Could not get location')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const handleCheckIn = async () => {
    setLocLoading(true);
    try {
      const { lat, lng } = await getLocation();
      checkInMut.mutate({ dutyId: duty._id, lat, lng });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLocLoading(true);
    try {
      const { lat, lng } = await getLocation();
      checkOutMut.mutate({ dutyId: duty._id, lat, lng });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocLoading(false);
    }
  };

  const openGoogleMaps = () => {
    const { lat, lng } = duty.location;
    const label = encodeURIComponent(duty.locationName || 'Duty Location');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`, '_blank');
  };

  const isActionLoading = locLoading || checkInMut.isPending || checkOutMut.isPending;
  const dutyStarted = new Date(duty.startDate) <= new Date();
  const canReject = !hasCheckedIn && !dutyStarted;
  // Check-in only makes sense once the duty is actually live — a 'draft' duty
  // hasn't started yet (the cron flips it to 'active' automatically right at
  // startDate), so check-in stays hidden/disabled until then instead of letting
  // the officer tap it and hit a backend error.
  const canCheckIn = duty.status === 'active' && dutyStarted;

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-bold text-ink-900 dark:text-white text-lg">{duty.dutyName}</h2>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <MapPin className="w-3.5 h-3.5 text-ink-400 shrink-0" />
            <span className="text-sm text-ink-500">{duty.locationName}</span>
            {duty.location?.lat && duty.location?.lng && (
              <span className="text-xs text-ink-400">
                ({duty.location.lat.toFixed(5)}, {duty.location.lng.toFixed(5)})
              </span>
            )}
          </div>
        </div>
        <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span>
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-ink-50 dark:bg-ink-800 rounded-lg p-2.5">
          <p className="text-xs text-ink-400 mb-0.5">Start</p>
          <p className="font-medium text-ink-800 dark:text-ink-200">{formatDateTime(duty.startDate)}</p>
        </div>
        <div className="bg-ink-50 dark:bg-ink-800 rounded-lg p-2.5">
          <p className="text-xs text-ink-400 mb-0.5">End</p>
          <p className="font-medium text-ink-800 dark:text-ink-200">{formatDateTime(duty.endDate)}</p>
        </div>
      </div>

      {/* Description */}
      {duty.description && (
        <p className="text-sm text-ink-600 dark:text-ink-400">{duty.description}</p>
      )}

      {/* Phones */}
      {duty.phoneNumbers?.length > 0 && (
        <div className="text-sm">
          <p className="text-xs text-ink-400 mb-1">Contact Numbers:</p>
          <div className="flex flex-wrap gap-2">
            {duty.phoneNumbers.map((ph, i) => (
              <a key={i} href={`tel:${ph}`} className="text-primary-600 hover:underline font-medium">{ph}</a>
            ))}
          </div>
        </div>
      )}

      {/* ── Attendance Section ── */}
      <div className="border border-ink-100 dark:border-ink-800 rounded-xl p-4 space-y-3 bg-ink-50/50 dark:bg-ink-800/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide">
            My Attendance
          </span>
          {attLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-400" />
          ) : (
            <AttBadge status={hasCheckedOut ? 'present' : hasCheckedIn ? 'partial' : 'absent'} />
          )}
        </div>

        {att && (
          <div className="grid grid-cols-2 gap-2 text-xs text-ink-600 dark:text-ink-400">
            {att.checkedInAt && (
              <div>
                <p className="text-ink-400">Checked In</p>
                <p className="font-medium text-ink-800 dark:text-ink-200">{formatDateTime(att.checkedInAt)}</p>
                {att.checkInDistanceMeters != null && (
                  <p className="text-ink-400">{att.checkInDistanceMeters}m from location</p>
                )}
              </div>
            )}
            {att.checkedOutAt && (
              <div>
                <p className="text-ink-400">Checked Out</p>
                <p className="font-medium text-ink-800 dark:text-ink-200">{formatDateTime(att.checkedOutAt)}</p>
                {att.durationMinutes != null && (
                  <p className="text-ink-400">
                    Duration: {Math.floor(att.durationMinutes / 60)}h {att.durationMinutes % 60}m
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Google Maps navigation button */}
          {duty.location?.lat && duty.location?.lng && (
            <button
              onClick={openGoogleMaps}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-signal2-50 text-signal2-700 dark:bg-signal2-900/20 dark:text-signal2-400 hover:bg-signal2-100 dark:hover:bg-signal2-900/30 font-medium transition-colors border border-signal2-200 dark:border-signal2-800"
            >
              <ExternalLink className="w-3 h-3" />
              Navigate on Maps
            </button>
          )}

          {/* Check-in button — only once the duty is actually live */}
          {!hasCheckedIn && canCheckIn && (
            <button
              onClick={handleCheckIn}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
              Check In
            </button>
          )}

          {/* Check-out button */}
          {hasCheckedIn && !hasCheckedOut && (
            <button
              onClick={handleCheckOut}
              disabled={isActionLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-signal-500 text-white hover:bg-signal-400 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
              Check Out
            </button>
          )}

          {hasCheckedOut && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              Duty completed
            </div>
          )}
        </div>

        {!hasCheckedIn && !canCheckIn && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Check-in opens once the duty starts ({formatDateTime(duty.startDate)}).
          </p>
        )}
        {!hasCheckedIn && canCheckIn && (
          <p className="text-xs text-ink-400">
            <Navigation className="w-3 h-3 inline mr-1" />
            You must be within 1 km of the duty location to check in.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-ink-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <AlertCircle className="w-4 h-4 text-signal-400" />
          Operator: {duty.operatorRef?.name || '—'}
        </div>
        {canReject ? (
          <button
            onClick={() => setRejectOpen(true)}
            className="btn-danger text-sm px-3 py-1.5"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        ) : !hasCheckedIn && dutyStarted ? (
          <span className="flex items-center gap-1.5 text-xs text-ink-400 font-medium">
            <Lock className="w-3.5 h-3.5" /> Duty started — can't reject
          </span>
        ) : null}
      </div>

      {/* Reject modal */}
      <Modal isOpen={rejectOpen} onClose={() => { setRejectOpen(false); setReason(''); }} title="Reject Duty Assignment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-400">
            Your operator will be notified immediately and will assign a replacement officer.
          </p>
          <div>
            <label className="form-label">Reason for rejection * (min 5 characters)</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. On leave, medical emergency, prior assignment conflict..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setRejectOpen(false); setReason(''); }} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => {
                if (reason.trim().length < 5) { toast.error('Please provide a more detailed reason'); return; }
                rejectMut.mutate({ dutyId: duty._id, reason });
              }}
              disabled={rejectMut.isPending}
              className="btn-danger flex-1"
            >
              {rejectMut.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OfficerDuties() {
  const { data: duties = [], isLoading } = useQuery({
    queryKey: ['officer-active'],
    queryFn: () => api.get('/officer/duties/active').then(r => r.data.data.duties),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold font-display text-ink-900 dark:text-white">My Duties</h1>

      {isLoading ? (
        <div className="card py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : duties.length === 0 ? (
        <div className="card p-12 text-center text-ink-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No duties assigned to you right now</p>
        </div>
      ) : (
        <div className="space-y-4">
          {duties.map(duty => <DutyCard key={duty._id} duty={duty} />)}
        </div>
      )}
    </div>
  );
}