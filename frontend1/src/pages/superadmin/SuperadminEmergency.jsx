import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Siren, AlertTriangle, CalendarOff, ShieldAlert, Clock, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDate, formatDateTime } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  active: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ended: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-ink-100 text-ink-600 dark:bg-white/[0.06] dark:text-ink-400',
};

const EMPTY_FORM = { reason: '', startDate: '', endDate: '' };

export default function SuperadminEmergency() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['emergency-active'],
    queryFn: () => api.get('/emergency/active').then(r => r.data.data),
    refetchInterval: 60000,
  });
  const active = activeData?.emergency;

  const { data: history } = useQuery({
    queryKey: ['emergency-history', page],
    queryFn: () => api.get(`/superadmin/emergency?limit=10&page=${page}`).then(r => r.data.data),
  });

  const declareMut = useMutation({
    mutationFn: (payload) => api.post('/superadmin/emergency', payload),
    onSuccess: (res) => {
      const { cancelledLeavesCount, broadcastCount } = res.data.data;
      toast.success(
        `Emergency Lockdown declared. ${cancelledLeavesCount} leave(s) cancelled, ${broadcastCount} people notified.`,
        { duration: 6000 }
      );
      qc.invalidateQueries({ queryKey: ['emergency-active'] });
      qc.invalidateQueries({ queryKey: ['emergency-history'] });
      setForm(EMPTY_FORM);
      setConfirmOpen(false);
    },
    onError: (err) => { toast.error(apiError(err)); setConfirmOpen(false); },
  });

  const endMut = useMutation({
    mutationFn: (id) => api.patch(`/superadmin/emergency/${id}/end`),
    onSuccess: () => {
      toast.success('Emergency Lockdown ended');
      qc.invalidateQueries({ queryKey: ['emergency-active'] });
      qc.invalidateQueries({ queryKey: ['emergency-history'] });
      setEndConfirmOpen(false);
    },
    onError: (err) => { toast.error(apiError(err)); setEndConfirmOpen(false); },
  });

  const canSubmit = form.reason.trim() && form.startDate && form.endDate;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Siren className="w-5 h-5 text-red-500" /> आपातकालीन लॉकडाउन — Emergency Lockdown
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Freeze leave approval hierarchy-wide for a period. Every admin, operator and officer under you is notified instantly,
          currently-approved leave overlapping the window is cancelled, and any new request for those dates can only be
          decided by you.
        </p>
      </div>

      {activeLoading ? (
        <div className="card py-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : active ? (
        // ─── Active lockdown status card ────────────────────────────────────
        <div className="card border-l-4 border-red-500 overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 animate-pulse">
                  <Siren className="w-5 h-5 text-red-600 dark:text-red-400" />
                </span>
                <div>
                  <p className="font-bold text-red-700 dark:text-red-400">Lockdown Active</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(active.startDate)} – {formatDate(active.endDate)}
                  </p>
                </div>
              </div>
              <button onClick={() => setEndConfirmOpen(true)} className="btn-danger text-sm">
                End Now
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3">
              {active.reason}
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1"><CalendarOff className="w-3.5 h-3.5" /> {active.cancelledLeavesCount} leave(s) auto-cancelled</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Declared {formatDateTime(active.createdAt)}</span>
            </div>
          </div>
        </div>
      ) : (
        // ─── Declare form ─────────────────────────────────────────────────────
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Declaring a lockdown immediately cancels every approved leave overlapping the window and notifies your entire
            hierarchy by push notification. Use only for genuine emergencies.
          </div>
          <div>
            <label className="form-label">Reason *</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Statewide law & order alert — all leave suspended until further notice"
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Start Date *</label>
              <input type="date" className="input-field" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">End Date *</label>
              <input type="date" className="input-field" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
            </div>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
            className="btn-danger w-full sm:w-auto"
          >
            <Siren className="w-4 h-4" /> Declare Emergency Lockdown
          </button>
        </div>
      )}

      {/* ─── History ──────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-800 dark:text-white text-sm">
          Lockdown History
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>{['Reason', 'Window', 'Cancelled Leaves', 'Status', 'Declared'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {history?.data?.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-gray-400 text-sm">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" /> No lockdowns declared yet
                </td></tr>
              ) : history?.data?.map(ep => (
                <tr key={ep._id} className="table-row">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[240px] truncate" title={ep.reason}>{ep.reason}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(ep.startDate)} – {formatDate(ep.endDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{ep.cancelledLeavesCount}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_BADGE[ep.status]}`}>{ep.status}{ep.endedBy === 'auto' ? ' (auto)' : ''}</span></td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(ep.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history?.pagination && <Pagination pagination={history.pagination} onPageChange={setPage} />}
      </div>

      {/* ─── Confirm declare ──────────────────────────────────────────────────── */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Emergency Lockdown">
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <Siren className="w-4 h-4 shrink-0 mt-0.5" />
            This will cancel every approved leave overlapping {form.startDate && formatDate(form.startDate)} – {form.endDate && formatDate(form.endDate)}
            {' '}and notify everyone under you immediately. This cannot be undone, only ended early.
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">"{form.reason}"</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => declareMut.mutate(form)}
              disabled={declareMut.isPending}
              className="btn-danger flex-1"
            >
              {declareMut.isPending ? 'Declaring...' : 'Yes, Declare Lockdown'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Confirm end early ────────────────────────────────────────────────── */}
      <Modal isOpen={endConfirmOpen} onClose={() => setEndConfirmOpen(false)} title="End Lockdown Early?">
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.03] rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            Normal leave approval routing resumes immediately, and everyone under you is notified the lockdown has ended.
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEndConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => endMut.mutate(active._id)}
              disabled={endMut.isPending}
              className="btn-primary flex-1"
            >
              {endMut.isPending ? 'Ending...' : 'Yes, End Now'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}