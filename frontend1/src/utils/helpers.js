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
    completed: 'bg-signal2-100 text-signal2-700 dark:bg-signal2-900/30 dark:text-signal2-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    accepted: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    replaced: 'bg-signal-100 text-signal-700',
    assigned: 'bg-signal2-100 text-signal2-700',
  };
  return map[status] || 'bg-ink-100 text-ink-600';
};

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
    superadmin: 'एसपी (सुपरएडमिन)',
    admin: 'एसीपी (एडमिन)',
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
