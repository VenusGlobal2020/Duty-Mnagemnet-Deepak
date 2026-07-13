import { format, formatDistanceToNow } from 'date-fns';

export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '-';
  return format(new Date(date), fmt);
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return format(new Date(date), 'dd MMM yyyy, hh:mm a');
};

export const timeAgo = (date) => {
  if (!date) return '-';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const getStatusColor = (status) => {
  const map = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    inactive: 'bg-ink-100 text-ink-600 dark:bg-white/[0.06] dark:text-ink-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    accepted: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    replaced: 'bg-signal-100 text-signal-700',
    assigned: 'bg-signal2-100 text-signal2-700',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    auto_rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return map[status] || 'bg-ink-100 text-ink-600';
};

// Whole-row tint + left accent bar for duty tables — draft=yellow, active=green,
// completed=blue, cancelled=red — so status is readable at a glance without
// reading every badge. Pair with <StatusLegend items={DUTY_STATUS_LEGEND} />.
export const getDutyRowClass = (status) => {
  const map = {
    draft: 'border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-900/[0.07]',
    active: 'border-l-4 border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/[0.07]',
    completed: 'border-l-4 border-blue-400 bg-blue-50/50 dark:bg-blue-900/[0.07]',
    cancelled: 'border-l-4 border-red-400 bg-red-50/50 dark:bg-red-900/[0.07]',
  };
  return map[status] || 'border-l-4 border-transparent';
};

export const DUTY_STATUS_LEGEND = [
  { status: 'draft', label: 'Draft', dot: 'bg-amber-400' },
  { status: 'active', label: 'Active', dot: 'bg-emerald-400' },
  { status: 'completed', label: 'Completed', dot: 'bg-blue-400' },
  { status: 'cancelled', label: 'Cancelled', dot: 'bg-red-400' },
];

// Same idea for leave request tables — pending=yellow, approved=green,
// rejected=red, cancelled=grey.
export const getLeaveRowClass = (status) => {
  const map = {
    pending: 'border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-900/[0.07]',
    approved: 'border-l-4 border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/[0.07]',
    rejected: 'border-l-4 border-red-400 bg-red-50/50 dark:bg-red-900/[0.07]',
    cancelled: 'border-l-4 border-ink-300 bg-ink-50/50 dark:bg-white/[0.03]',
  };
  return map[status] || 'border-l-4 border-transparent';
};

export const LEAVE_STATUS_LEGEND = [
  { status: 'pending', label: 'Pending', dot: 'bg-amber-400' },
  { status: 'approved', label: 'Approved', dot: 'bg-emerald-400' },
  { status: 'rejected', label: 'Rejected', dot: 'bg-red-400' },
  { status: 'cancelled', label: 'Cancelled', dot: 'bg-ink-400' },
];

export const getPriorityColor = (priority) => {
  const map = {
    1: 'bg-red-100 text-red-700 border-red-200',
    2: 'bg-signal-100 text-signal-700 border-signal-200',
    3: 'bg-amber-100 text-amber-700 border-amber-200',
    4: 'bg-signal2-100 text-signal2-700 border-signal2-200',
    5: 'bg-ink-100 text-ink-700 border-ink-200',
  };
  return map[priority] || 'bg-ink-100 text-ink-700';
};

export const getPriorityLabel = (priority) => {
  const map = { 1: 'अति महत्वपूर्ण', 2: 'उच्च', 3: 'मध्यम', 4: 'निम्न', 5: 'न्यूनतम' };
  return map[priority] || `P${priority}`;
};

export const getRoleLabel = (role) => {
  const map = {
    master: 'मास्टर',
    superadmin: 'सुपरएडमिन',
    admin: 'एडमिन',
    operator_special: 'विशेष ऑपरेटर',
    operator_regular: 'सामान्य ऑपरेटर',
    officer: 'अधिकारी',
  };
  return map[role] || role;
};

export const getRoleBadgeColor = (role) => {
  const map = {
    master: 'bg-violet-100 text-violet-700',
    superadmin: 'bg-red-100 text-red-700',
    admin: 'bg-signal-100 text-signal-700',
    operator_special: 'bg-signal2-100 text-signal2-700',
    operator_regular: 'bg-cyan-100 text-cyan-700',
    officer: 'bg-emerald-100 text-emerald-700',
  };
  return map[role] || 'bg-ink-100 text-ink-700';
};

export const getDutyTypeColor = (type) => {
  const map = {
    VVIP: 'bg-violet-100 text-violet-700',
    'CITY-POINT': 'bg-signal2-100 text-signal2-700',
    CRIMINAL: 'bg-red-100 text-red-700',
  };
  return map[type] || 'bg-ink-100 text-ink-700';
};

export const truncate = (str, len = 40) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
};

export const apiError = (error) => {
  return error.response?.data?.message || error.message || 'कुछ गड़बड़ हो गई';
};