import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, XCircle, MapPin, Clock, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime, getPriorityLabel, getPriorityColor, getStatusColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

export default function OfficerDuties() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason] = useState('');

  const { data: duties = [], isLoading } = useQuery({
    queryKey: ['officer-active'],
    queryFn: () => api.get('/officer/duties/active').then(r => r.data.data.duties),
  });

  const rejectMut = useMutation({
    mutationFn: ({ dutyId, reason }) => api.patch(`/officer/duties/${dutyId}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Duty rejected. Your operator has been notified.');
      qc.invalidateQueries(['officer-active']);
      setRejectTarget(null);
      setReason('');
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Active Duties</h1>

      {isLoading ? (
        <div className="card py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : duties.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No active duties assigned to you</p>
        </div>
      ) : (
        <div className="space-y-4">
          {duties.map(duty => (
            <div key={duty._id} className="card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg">{duty.dutyName}</h2>
                  <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {duty.locationName}
                  </p>
                </div>
                <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-400 mb-0.5">Start</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{formatDateTime(duty.startDate)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-400 mb-0.5">End</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{formatDateTime(duty.endDate)}</p>
                </div>
              </div>

              {duty.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{duty.description}</p>
              )}

              {duty.phoneNumbers?.length > 0 && (
                <div className="text-sm">
                  <p className="text-xs text-gray-400 mb-1">Contact Numbers:</p>
                  <div className="flex flex-wrap gap-2">
                    {duty.phoneNumbers.map((ph, i) => (
                      <a key={i} href={`tel:${ph}`} className="text-primary-600 hover:underline font-medium">{ph}</a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  Operator: {duty.operatorRef?.name || '—'}
                </div>
                <button
                  onClick={() => setRejectTarget(duty)}
                  className="btn-danger text-sm px-3 py-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!rejectTarget} onClose={() => { setRejectTarget(null); setReason(''); }} title="Reject Duty Assignment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
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
            <button onClick={() => { setRejectTarget(null); setReason(''); }} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => {
                if (reason.trim().length < 5) { toast.error('Please provide a more detailed reason'); return; }
                rejectMut.mutate({ dutyId: rejectTarget._id, reason });
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
