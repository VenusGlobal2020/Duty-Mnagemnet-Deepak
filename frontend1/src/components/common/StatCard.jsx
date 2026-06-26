export default function StatCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const colors = {
    blue:   { wrap: 'bg-signal2-100 dark:bg-signal2-400/10 text-signal2-600 dark:text-signal2-300', ring: 'text-signal2-400/60' },
    green:  { wrap: 'bg-emerald-100 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400', ring: 'text-emerald-400/60' },
    red:    { wrap: 'bg-red-100 dark:bg-red-400/10 text-red-600 dark:text-red-400', ring: 'text-red-400/60' },
    orange: { wrap: 'bg-signal-100 dark:bg-signal-400/10 text-signal-600 dark:text-signal-400', ring: 'text-signal-400/60' },
    purple: { wrap: 'bg-violet-100 dark:bg-violet-400/10 text-violet-600 dark:text-violet-400', ring: 'text-violet-400/60' },
    yellow: { wrap: 'bg-amber-100 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400', ring: 'text-amber-400/60' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`stat-card bracket-frame ${c.ring}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.wrap}`}>
        <Icon className="w-6 h-6" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-display text-ink-900 dark:text-white tabular-nums">{value ?? '—'}</p>
        <p className="text-sm text-ink-500 dark:text-ink-400 truncate">{label}</p>
        {sub && <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
