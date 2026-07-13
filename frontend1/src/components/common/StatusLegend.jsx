/**
 * Tiny "which colour means what" strip — drop above or below any table that
 * uses getDutyRowClass / getLeaveRowClass so the row-tinting is self-explanatory
 * instead of requiring the user to guess.
 *
 * items: [{ status, label, dot }] — see DUTY_STATUS_LEGEND / LEAVE_STATUS_LEGEND
 * in utils/helpers.js.
 */
export default function StatusLegend({ items }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-xs text-ink-500 dark:text-ink-400 bg-ink-50/60 dark:bg-white/[0.02] border-b border-ink-200/70 dark:border-white/[0.06]">
      <span className="font-medium text-ink-400">Colour key:</span>
      {items.map(it => (
        <span key={it.status} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${it.dot} shrink-0`} />
          {it.label}
        </span>
      ))}
    </div>
  );
}