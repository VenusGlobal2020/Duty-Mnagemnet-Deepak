import {
  ClipboardList, FileEdit, XCircle, Ban, RefreshCw, Lock, CheckCircle,
  Clock, Repeat, Undo2, Shuffle, FileText, AlertTriangle, Siren, Bell,
} from 'lucide-react';

// Single source of truth for how each notification `type` is presented:
// icon component + background/icon tint. Used by both <NotificationBell>
// (dropdown) and <NotificationsPage> (full history) so the two stay in sync.
export const NOTIF_TYPE_META = {
  duty_assigned:          { icon: ClipboardList, label: 'Duty Assigned',      bg: 'bg-blue-50 dark:bg-blue-900/10',       fg: 'text-blue-600 dark:text-blue-400' },
  duty_updated:           { icon: FileEdit,       label: 'Duty Updated',       bg: 'bg-yellow-50 dark:bg-yellow-900/10',   fg: 'text-yellow-600 dark:text-yellow-400' },
  duty_cancelled:         { icon: XCircle,        label: 'Duty Cancelled',     bg: 'bg-red-50 dark:bg-red-900/10',         fg: 'text-red-600 dark:text-red-400' },
  duty_rejected:          { icon: Ban,            label: 'Officer Rejected',   bg: 'bg-orange-50 dark:bg-orange-900/10',   fg: 'text-orange-600 dark:text-orange-400' },
  officer_replaced:       { icon: RefreshCw,      label: 'Officer Replaced',   bg: 'bg-purple-50 dark:bg-purple-900/10',   fg: 'text-purple-600 dark:text-purple-400' },
  account_suspended:      { icon: Lock,           label: 'Account Suspended',  bg: 'bg-red-50 dark:bg-red-900/10',         fg: 'text-red-600 dark:text-red-400' },
  account_activated:      { icon: CheckCircle,    label: 'Account Activated',  bg: 'bg-green-50 dark:bg-green-900/10',     fg: 'text-green-600 dark:text-green-400' },
  attendance_checkin:     { icon: Clock,          label: 'Attendance',         bg: 'bg-teal-50 dark:bg-teal-900/10',       fg: 'text-teal-600 dark:text-teal-400' },
  swap_requested:         { icon: Repeat,         label: 'Swap Requested',     bg: 'bg-amber-50 dark:bg-amber-900/10',     fg: 'text-amber-600 dark:text-amber-400' },
  swap_accepted:          { icon: CheckCircle,    label: 'Swap Accepted',      bg: 'bg-emerald-50 dark:bg-emerald-900/10', fg: 'text-emerald-600 dark:text-emerald-400' },
  swap_rejected:          { icon: XCircle,        label: 'Swap Rejected',      bg: 'bg-red-50 dark:bg-red-900/10',         fg: 'text-red-600 dark:text-red-400' },
  swap_cancelled:         { icon: Undo2,          label: 'Swap Cancelled',     bg: 'bg-gray-50 dark:bg-gray-900/10',       fg: 'text-gray-500 dark:text-gray-400' },
  swap_executed:          { icon: Shuffle,        label: 'Swap Executed',      bg: 'bg-purple-50 dark:bg-purple-900/10',   fg: 'text-purple-600 dark:text-purple-400' },
  leave_requested:        { icon: FileText,       label: 'Leave Requested',    bg: 'bg-indigo-50 dark:bg-indigo-900/10',   fg: 'text-indigo-600 dark:text-indigo-400' },
  leave_approved:         { icon: CheckCircle,    label: 'Leave Approved',     bg: 'bg-green-50 dark:bg-green-900/10',     fg: 'text-green-600 dark:text-green-400' },
  leave_rejected:         { icon: XCircle,        label: 'Leave Rejected',     bg: 'bg-red-50 dark:bg-red-900/10',         fg: 'text-red-600 dark:text-red-400' },
  leave_cancelled:        { icon: XCircle,        label: 'Leave Cancelled',    bg: 'bg-gray-50 dark:bg-gray-900/10',       fg: 'text-gray-500 dark:text-gray-400' },
  leave_conflict:         { icon: AlertTriangle,  label: 'Leave Conflict',     bg: 'bg-orange-50 dark:bg-orange-900/10',   fg: 'text-orange-600 dark:text-orange-400' },
  leave_threshold_locked: { icon: Lock,           label: 'Leave Locked',       bg: 'bg-red-50 dark:bg-red-900/10',         fg: 'text-red-600 dark:text-red-400' },
  emergency_declared:     { icon: Siren,          label: 'Emergency Declared', bg: 'bg-red-50 dark:bg-red-900/10',         fg: 'text-red-600 dark:text-red-400' },
  emergency_ended:        { icon: CheckCircle,    label: 'Emergency Ended',    bg: 'bg-green-50 dark:bg-green-900/10',     fg: 'text-green-600 dark:text-green-400' },
  general:                { icon: Bell,           label: 'General',           bg: 'bg-gray-50 dark:bg-gray-900/10',       fg: 'text-gray-500 dark:text-gray-400' },
};

export function getNotifMeta(type) {
  return NOTIF_TYPE_META[type] || NOTIF_TYPE_META.general;
}
