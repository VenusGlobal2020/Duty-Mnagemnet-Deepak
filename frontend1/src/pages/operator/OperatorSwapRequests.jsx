import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight, Check, X, History, Clock, CheckCircle,
  XCircle, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDateTime } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

function SwapStatusBadge({ status }) {
  const map = {
    pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    executed:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.pending}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}

export default function OperatorSwapRequests() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionTarget, setActionTarget] = useState(null); // { swap, action }
  const [opNote, setOpNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['op-all-swaps', statusFilter],
    queryFn: () =>
      api.get(`/operator/swaps?status=${statusFilter || 'all'}`).then(r => r.data.data),
  });

  const swaps      = data?.swaps || [];
  const pagination = null; // backend returns all at once, no pagination


  const acceptMut = useMutation({
    mutationFn: ({ swapId, note }) =>
      api.patch(`/operator/swaps/${swapId}/accept`, { operatorNote: note }),
    onSuccess: () => {
      toast.success('Swap accepted and executed!');
      qc.invalidateQueries(['op-all-swaps']);
      setActionTarget(null);
      setOpNote('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const rejectMut = useMutation({
    mutationFn: ({ swapId, note }) => api.patch(`/operator/swaps/${swapId}/reject`, { operatorNote: note }),
    onSuccess: () => {
      toast.success('Swap request rejected.');
      qc.invalidateQueries(['op-all-swaps']);
      setActionTarget(null);
      setOpNote('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const FILTERS = [
    { value: 'pending',   label: 'Pending',   icon: <Clock className="w-3.5 h-3.5" /> },
    { value: 'executed',  label: 'Executed',  icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { value: 'rejected',  label: 'Rejected',  icon: <XCircle className="w-3.5 h-3.5" /> },
    { value: 'all',       label: 'All',       icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-display text-ink-900 dark:text-white flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-purple-500" />
          Swap Requests
        </h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
          Manage officer swap requests across all your duties
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-ink-800 border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:border-primary-300'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="card py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : swaps.length === 0 ? (
          <div className="card p-12 text-center text-ink-400">
            <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No swap requests found</p>
          </div>
        ) : (
          swaps.map(swap => (
            <div
              key={swap._id}
              className={`card p-4 border-l-4 ${
                swap.status === 'pending'
                  ? 'border-l-amber-400'
                  : swap.status === 'executed'
                  ? 'border-l-emerald-400'
                  : swap.status === 'rejected'
                  ? 'border-l-red-400'
                  : 'border-l-ink-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Left: info */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">
                      {swap.fromOfficer?.name || swap.requestedBy?.name || '—'}
                    </span>
                    <span className="text-xs text-ink-400">→</span>
                    <span className="text-sm text-ink-700 dark:text-ink-300">
                      {swap.toOfficer?.name || '—'}
                    </span>
                    <SwapStatusBadge status={swap.status} />
                    {swap.assignment?.rankRef && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full text-white font-semibold"
                        style={{ backgroundColor: swap.assignment.rankRef.color || '#6b7280' }}
                      >
                        {swap.assignment.rankRef.code}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    Duty: <span className="font-medium text-ink-700 dark:text-ink-300">{swap.duty?.dutyName || '—'}</span>
                  </p>

                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    Reason: <span className="font-medium text-ink-700 dark:text-ink-300">{swap.requestReason}</span>
                  </p>

                  {swap.status === 'accepted' && swap.replacedWith && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      → Replaced with: <span className="font-medium">{swap.replacedWith.name}</span>
                    </p>
                  )}

                  {swap.operatorNote && (
                    <p className="text-xs text-ink-400">
                      Your note: {swap.operatorNote}
                    </p>
                  )}

                  <p className="text-xs text-ink-400">{formatDateTime(swap.createdAt)}</p>
                </div>

                {/* Right: actions */}
                {swap.status === 'pending' && (
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
                )}
              </div>
            </div>
          ))
        )}
      </div>


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
              <p className="text-ink-600 dark:text-ink-400">
                Duty: <span className="font-medium text-ink-900 dark:text-white">{actionTarget.swap.duty?.dutyName}</span>
              </p>
              <p className="text-xs text-ink-400">Reason: {actionTarget.swap.requestReason}</p>
            </div>

            <div>
              <label className="form-label">Note to officers (optional)</label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="e.g. Report to same location, already briefed..."
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
            <div className="p-3 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm space-y-1">
              <p className="text-ink-600 dark:text-ink-400">
                Officer: <span className="font-medium text-ink-900 dark:text-white">{actionTarget.swap.requestedBy?.name}</span>
              </p>
              <p className="text-xs text-ink-400">Reason: {actionTarget.swap.requestReason}</p>
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
              <button onClick={() => { setActionTarget(null); setOpNote(''); }} className="btn-secondary flex-1">
                Cancel
              </button>
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