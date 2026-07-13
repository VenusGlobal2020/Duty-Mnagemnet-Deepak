// Shared across every leave-related page (officer/admin/superadmin) plus the
// sidebar unread-badge, so the labels + notification-type list stay in one place.

export const LEAVE_TYPE_LABEL = {
  casual: 'Casual Leave',
  earned: 'Earned Leave',
  emergency: 'Emergency Leave',
  medical: 'Medical Leave',
  maternity: 'Maternity Leave',
  childcare: 'Child Care Leave',
};

export const APPROVER_LABEL = {
  inspector: 'Inspector (Thana)',
  dsp: 'DSP (Zone)',
  admin: 'Admin',
  superadmin: 'Superadmin',
};

// Every Notification `type` (see backend models/Notification.js) that relates
// to the leave module — used to light up the "अवकाश प्रबंधन" sidebar tab
// whenever an unread notification of one of these types exists.
export const LEAVE_NOTIFICATION_TYPES = [
  'leave_requested',
  'leave_approved',
  'leave_rejected',
  'leave_cancelled',
  'leave_conflict',
  'leave_threshold_locked',
];