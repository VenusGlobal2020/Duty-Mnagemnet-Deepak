import { FileText, Image as ImageIcon, Download, User, Building2, Map, Clock,
  CheckCircle, XCircle, AlertTriangle, ShieldAlert, CalendarDays, Paperclip, Ban } from 'lucide-react';
import Modal from '../common/Modal';
import { formatDate, formatDateTime, getStatusColor } from '../../utils/helpers';
import { LEAVE_TYPE_LABEL, APPROVER_LABEL } from '../../utils/leaveConstants';

const TIMELINE_LABEL = {
  REQUESTED: 'Request submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  AUTO_REJECTED: 'Auto-rejected',
};

const isImageDoc = (doc) => {
  const name = (doc?.originalName || doc?.url || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp)$/.test(name);
};

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-ink-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-ink-400 font-medium">{label}</p>
        <p className="text-sm text-ink-800 dark:text-ink-100 break-words">{value}</p>
      </div>
    </div>
  );
}

/**
 * Full-detail view for a single leave request — applicant info, dates,
 * remark, the supporting document (if any), routing/decision info, and an
 * optional embedded approve/reject or cancel action.
 *
 * Props:
 *  - leave: the leave request object (populated)
 *  - actionable: when true and leave.status === 'pending', shows Approve/Reject
 *  - decisionNote / onDecisionNoteChange, onApprove, onReject, decisionPending
 *  - onCancel / cancelPending: shown instead of decide actions (officer's own leave)
 */
export default function LeaveDetailModal({
  isOpen, onClose, leave,
  actionable = false,
  decisionNote = '', onDecisionNoteChange, onApprove, onReject, decisionPending = false,
  onCancel, cancelPending = false,
}) {
  if (!leave) return null;

  const applicantName = leave.officerRef?.name || leave.applicantRef?.name || 'Unknown';
  const isAdminApplicant = leave.applicantRole === 'admin';
  const doc = leave.document?.url ? leave.document : null;
  const showDecide = actionable && leave.status === 'pending';
  const showCancel = !!onCancel && ['pending', 'approved'].includes(leave.status);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Leave Request Details" size="lg">
      <div className="space-y-5">
        {/* Header: applicant + status */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-signal-500 to-signal2-500 flex items-center justify-center text-white font-bold shrink-0">
              {applicantName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-ink-900 dark:text-white text-sm">{applicantName}</p>
              <p className="text-xs text-ink-400">
                {isAdminApplicant ? 'Admin' : leave.officerRef?.badgeNumber ? `#${leave.officerRef.badgeNumber}` : 'Officer'}
                {leave.rankRef?.name && ` · ${leave.rankRef.name}`}
              </p>
            </div>
          </div>
          <span className={`badge ${getStatusColor(leave.status)} capitalize`}>{leave.status}</span>
        </div>

        {/* Core details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-ink-50 dark:bg-white/[0.03] rounded-xl p-4">
          <InfoRow icon={CalendarDays} label="Leave Type" value={LEAVE_TYPE_LABEL[leave.leaveType]} />
          <InfoRow icon={Clock} label="Duration" value={`${formatDate(leave.fromDate)} – ${formatDate(leave.toDate)} (${leave.totalDays} day${leave.totalDays > 1 ? 's' : ''})`} />
          {(leave.thanaAtRequest || leave.officerRef?.thana) && (
            <InfoRow icon={Building2} label="Thana" value={leave.thanaAtRequest || leave.officerRef?.thana} />
          )}
          {(leave.zoneAtRequest || leave.officerRef?.zone) && (
            <InfoRow icon={Map} label="Zone" value={leave.zoneAtRequest || leave.officerRef?.zone} />
          )}
          <InfoRow icon={User} label="Goes To" value={APPROVER_LABEL[leave.approverLevel] || leave.approverLevel} />
          <InfoRow icon={Clock} label="Applied On" value={formatDateTime(leave.createdAt)} />
        </div>

        {/* Remark */}
        {leave.remark && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-400 font-medium mb-1">Remark</p>
            <p className="text-sm text-ink-700 dark:text-ink-200 bg-ink-50 dark:bg-white/[0.03] rounded-xl p-3 whitespace-pre-wrap">{leave.remark}</p>
          </div>
        )}

        {/* Supporting document */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-400 font-medium mb-1.5 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Supporting Document
          </p>
          {!doc ? (
            <p className="text-sm text-ink-400 italic">No document attached</p>
          ) : isImageDoc(doc) ? (
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block group w-fit">
              <img
                src={doc.url}
                alt={doc.originalName || 'Leave document'}
                className="max-h-56 rounded-xl border border-ink-200 dark:border-white/10 shadow-sm group-hover:opacity-90 transition-opacity"
              />
              <span className="mt-1.5 flex items-center gap-1 text-xs text-signal2-600 dark:text-signal2-400 group-hover:underline">
                <ImageIcon className="w-3.5 h-3.5" /> {doc.originalName || 'View full image'}
              </span>
            </a>
          ) : (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-ink-50 dark:bg-white/[0.03] hover:bg-ink-100 dark:hover:bg-white/[0.06] transition-colors rounded-xl p-3 w-full sm:w-auto"
            >
              <div className="w-9 h-9 rounded-lg bg-signal-100 dark:bg-signal-500/15 flex items-center justify-center shrink-0">
                <FileText className="w-4.5 h-4.5 text-signal-600 dark:text-signal-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{doc.originalName || 'Document'}</p>
                <p className="text-xs text-ink-400">Click to view / download</p>
              </div>
              <Download className="w-4 h-4 text-ink-400 shrink-0" />
            </a>
          )}
        </div>

        {/* Routing fallback note */}
        {leave.routingFallback && leave.routingNote && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {leave.routingNote}
          </div>
        )}

        {/* Threshold lock flag */}
        {leave.wasThresholdLocked && (
          <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> This request hit the leave threshold lock at some point in its lifecycle.
          </div>
        )}

        {/* Conflicting duties */}
        {leave.conflictingDuties?.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {leave.conflictingDuties.length} duty assignment{leave.conflictingDuties.length > 1 ? 's' : ''} overlapped this leave —
            {' '}{leave.conflictingDuties.filter(c => c.resolved).length}/{leave.conflictingDuties.length} resolved.
          </div>
        )}

        {/* Decision info (already decided) */}
        {leave.status !== 'pending' && leave.decidedAt && (
          <div className="border-t border-ink-200/70 dark:border-white/[0.06] pt-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-400 font-medium mb-1">
              {leave.status === 'approved' ? 'Approved' : leave.status === 'rejected' ? 'Rejected' : 'Decided'} By
            </p>
            <p className="text-sm text-ink-800 dark:text-ink-100">
              {leave.decidedBy?.name || '—'} · <span className="text-ink-400">{formatDateTime(leave.decidedAt)}</span>
            </p>
            {leave.decisionNote && <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 italic">"{leave.decisionNote}"</p>}
          </div>
        )}

        {/* Timeline */}
        {leave.timeline?.length > 0 && (
          <div className="border-t border-ink-200/70 dark:border-white/[0.06] pt-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-400 font-medium mb-2">Timeline</p>
            <ul className="space-y-2">
              {leave.timeline.map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-400 shrink-0 mt-1.5" />
                  <div className="min-w-0">
                    <p className="text-ink-700 dark:text-ink-200">{TIMELINE_LABEL[t.action] || t.action}</p>
                    <p className="text-xs text-ink-400">{formatDateTime(t.performedAt)}{t.note ? ` · ${t.note}` : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Embedded decide action */}
        {showDecide && (
          <div className="border-t border-ink-200/70 dark:border-white/[0.06] pt-4 space-y-3">
            <div>
              <label className="form-label">Decision Note (optional)</label>
              <textarea
                className="input-field"
                rows={2}
                value={decisionNote}
                onChange={e => onDecisionNoteChange?.(e.target.value)}
                placeholder="Add a note for the applicant..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={onReject} disabled={decisionPending} className="btn-danger flex-1">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button onClick={onApprove} disabled={decisionPending} className="btn-primary flex-1">
                <CheckCircle className="w-4 h-4" /> {decisionPending ? 'Saving...' : 'Approve'}
              </button>
            </div>
          </div>
        )}

        {/* Cancel action (officer's own leave) */}
        {showCancel && !showDecide && (
          <div className="border-t border-ink-200/70 dark:border-white/[0.06] pt-4">
            <button onClick={onCancel} disabled={cancelPending} className="btn-danger w-full">
              <Ban className="w-4 h-4" /> {cancelPending ? 'Cancelling...' : 'Cancel This Leave Request'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}