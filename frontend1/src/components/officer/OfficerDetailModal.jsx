import { Phone, Mail, Cake, MapPin, Map, Briefcase, Shield, Building2,
  ClipboardCheck, XCircle, Clock, CalendarOff, LogIn } from 'lucide-react';
import Modal from '../common/Modal';
import { formatDate, formatDateTime, getStatusColor } from '../../utils/helpers';
import { LEAVE_TYPE_LABEL } from '../../utils/leaveConstants';

const AVAILABILITY_LABEL = {
  available: { label: 'Available for Duty', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  on_leave: { label: 'On Leave', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  pending_return: { label: 'Pending Return', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
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
 * Full-detail view for a single officer — every field on the Officer record
 * in one place, opened by clicking a row on the Admin/Superadmin officer
 * roster. Read-only (officer records themselves are managed by operators).
 *
 * showAdmin: pass true on the Superadmin page to also show which admin this
 * officer reports to (irrelevant on the Admin page — it's always "you").
 */
export default function OfficerDetailModal({ isOpen, onClose, officer, showAdmin = false }) {
  if (!officer) return null;
  const avail = AVAILABILITY_LABEL[officer.dutyAvailability] || AVAILABILITY_LABEL.available;
  const leave = officer.currentLeaveRef;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Officer Details" size="lg">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ backgroundColor: officer.rankRef?.color || '#6b7280' }}
            >
              {officer.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-ink-900 dark:text-white">{officer.name}</p>
              <p className="text-xs text-ink-400">
                {officer.badgeNumber ? `#${officer.badgeNumber}` : 'No badge assigned'}
                {officer.rankRef && ` · ${officer.rankRef.code} — ${officer.rankRef.name}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            <span className={`badge ${getStatusColor(officer.status)} capitalize`}>{officer.status}</span>
            <span className={`badge ${avail.cls}`}>{avail.label}</span>
          </div>
        </div>

        {/* Currently on leave */}
        {leave && officer.dutyAvailability === 'on_leave' && (
          <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <CalendarOff className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{LEAVE_TYPE_LABEL[leave.leaveType] || leave.leaveType}</p>
              <p className="text-xs">{formatDate(leave.fromDate)} – {formatDate(leave.toDate)}</p>
              {leave.remark && <p className="text-xs italic mt-0.5">"{leave.remark}"</p>}
            </div>
          </div>
        )}

        {/* Core details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-ink-50 dark:bg-white/[0.03] rounded-xl p-4">
          <InfoRow icon={Phone} label="Phone" value={officer.phone} />
          <InfoRow icon={Mail} label="Email" value={officer.email} />
          <InfoRow icon={Cake} label="Date of Birth" value={officer.dateOfBirth ? formatDate(officer.dateOfBirth) : null} />
          <InfoRow icon={Shield} label="Gender" value={officer.gender ? officer.gender[0].toUpperCase() + officer.gender.slice(1) : null} />
          <InfoRow icon={Briefcase} label="Designation" value={officer.designation} />
          {showAdmin && <InfoRow icon={Building2} label="Admin" value={officer.adminRef?.name} />}
          <InfoRow icon={MapPin} label="Thana" value={officer.thana} />
          <InfoRow icon={Map} label="Zone" value={officer.zone} />
        </div>

        {/* Duty stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink-200/70 dark:border-white/[0.06] p-3 flex items-center gap-2.5">
            <ClipboardCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-ink-900 dark:text-white leading-none">{officer.totalDutiesCompleted ?? 0}</p>
              <p className="text-[11px] text-ink-400 mt-0.5">Duties Completed</p>
            </div>
          </div>
          <div className="rounded-xl border border-ink-200/70 dark:border-white/[0.06] p-3 flex items-center gap-2.5">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-ink-900 dark:text-white leading-none">{officer.totalDutiesRejected ?? 0}</p>
              <p className="text-[11px] text-ink-400 mt-0.5">Duties Rejected</p>
            </div>
          </div>
        </div>

        {/* Account info */}
        <div className="border-t border-ink-200/70 dark:border-white/[0.06] pt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-400">
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Joined {formatDate(officer.createdAt)}</span>
          {officer.userRef?.lastLogin && (
            <span className="flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5" /> Last login {formatDateTime(officer.userRef.lastLogin)}</span>
          )}
        </div>
      </div>
    </Modal>
  );
}