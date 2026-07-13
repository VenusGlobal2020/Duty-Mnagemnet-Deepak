import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';

/**
 * Dashboard "you have pending approvals" widget — shown on Admin, Superadmin,
 * Officer (Inspector/DSP) and Operator dashboards so a pending leave/swap
 * request is impossible to miss without having to open the full list first.
 *
 * Renders nothing when there's nothing pending (count === 0), so it never
 * clutters the dashboard when the user is caught up.
 *
 * Props:
 *  - title: e.g. "Leave Requests"
 *  - count: total pending count (may be larger than items.length)
 *  - items: the latest 2–3 items to preview
 *  - renderItem: (item) => JSX row
 *  - viewAllTo: route to the full approvals list
 */
export default function PendingApprovalsCard({ title, count, items, renderItem, viewAllTo }) {
  const navigate = useNavigate();
  if (!count) return null;

  return (
    <div className="card border-l-4 border-amber-400 overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-ink-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
          </span>
          <div className="min-w-0">
            <h2 className="section-title !mb-0 truncate">{title}</h2>
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              {count} request{count !== 1 ? 's' : ''} pending for approval
            </p>
          </div>
        </div>
        {viewAllTo && (
          <button
            onClick={() => navigate(viewAllTo)}
            className="text-sm text-signal2-600 dark:text-signal2-400 hover:underline font-medium shrink-0"
          >
            View all
          </button>
        )}
      </div>
      <div className="divide-y divide-ink-100 dark:divide-white/[0.05]">
        {items.map(renderItem)}
      </div>
    </div>
  );
}