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
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    replaced: 'bg-orange-100 text-orange-700',
    assigned: 'bg-blue-100 text-blue-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

export const getPriorityColor = (priority) => {
  const map = {
    1: 'bg-red-100 text-red-700 border-red-200',
    2: 'bg-orange-100 text-orange-700 border-orange-200',
    3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    4: 'bg-blue-100 text-blue-700 border-blue-200',
    5: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return map[priority] || 'bg-gray-100 text-gray-700';
};

export const getPriorityLabel = (priority) => {
  const map = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Minimal' };
  return map[priority] || `P${priority}`;
};

export const getRoleLabel = (role) => {
  const map = {
    master: 'Master',
    superadmin: 'SP (Superadmin)',
    admin: 'ACP (Admin)',
    operator_special: 'Special Operator',
    operator_regular: 'Regular Operator',
    officer: 'Officer',
  };
  return map[role] || role;
};

export const getRoleBadgeColor = (role) => {
  const map = {
    master: 'bg-purple-100 text-purple-700',
    superadmin: 'bg-red-100 text-red-700',
    admin: 'bg-orange-100 text-orange-700',
    operator_special: 'bg-blue-100 text-blue-700',
    operator_regular: 'bg-cyan-100 text-cyan-700',
    officer: 'bg-green-100 text-green-700',
  };
  return map[role] || 'bg-gray-100 text-gray-700';
};

export const getDutyTypeColor = (type) => {
  const map = {
    VVIP: 'bg-purple-100 text-purple-700',
    'CITY-POINT': 'bg-blue-100 text-blue-700',
    CRIMINAL: 'bg-red-100 text-red-700',
  };
  return map[type] || 'bg-gray-100 text-gray-700';
};

export const truncate = (str, len = 40) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
};

export const apiError = (error) => {
  return error.response?.data?.message || error.message || 'Something went wrong';
};
