// Resolves where a duty-related notification should navigate to, based on
// the logged-in user's role. Each role views duty details differently
// (dedicated page, modal-in-table, or inline card), so this centralizes
// that mapping in one place.
//
// Returns null when the role has no duty-detail view to jump to (e.g.
// "master", who doesn't manage duties directly) — callers should fall back
// to just marking the notification read / staying on the notifications list.
export function getDutyNavPath(role, dutyId) {
  if (!role || !dutyId) return null;
  if (role === 'officer') return `/officer/duties?duty=${dutyId}`;
  if (role?.startsWith('operator')) return `/operator/duties/${dutyId}`;
  if (role === 'admin') return `/admin/duties?duty=${dutyId}`;
  if (role === 'superadmin') return `/superadmin/duties?duty=${dutyId}`;
  return null;
}
