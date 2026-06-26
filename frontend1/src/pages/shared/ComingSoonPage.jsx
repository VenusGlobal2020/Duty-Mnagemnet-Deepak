import { useLocation } from 'react-router-dom';
import { Sparkles, Construction } from 'lucide-react';

// Per-route flavor text so the placeholder feels intentional rather than generic.
const META = {
  '/leave': {
    title: 'Leave Management',
    blurb: 'Apply for leave, track approval status, and manage duty roster conflicts — all from one place.',
  },
  '/attendance': {
    title: 'Attendance',
    blurb: 'Daily attendance rollups, shift logs, and biometric sync across every posting.',
  },
  '/audit-log': {
    title: 'Audit Log',
    blurb: 'A complete, tamper-evident trail of every action taken across the system.',
  },
};

function metaFor(pathname) {
  const key = Object.keys(META).find(k => pathname.includes(k));
  return META[key] || { title: 'Module', blurb: 'This module is being built.' };
}

export default function ComingSoonPage({ title: titleProp }) {
  const { pathname } = useLocation();
  const { title, blurb } = metaFor(pathname);
  const heading = titleProp || title;

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="max-w-lg w-full text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-2xl bg-signal2-400/15 dark:bg-signal2-400/10 animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-ink-800 to-ink-900 dark:from-ink-700 dark:to-ink-900 border border-ink-600/40 flex items-center justify-center shadow-panel">
            <Construction className="w-9 h-9 text-signal2-400" strokeWidth={1.75} />
          </div>
        </div>

        <span className="badge bg-signal2-400/10 text-signal2-600 dark:text-signal2-300 border border-signal2-400/30 mb-3">
          <Sparkles className="w-3 h-3 mr-1" /> In development
        </span>

        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white mt-3">{heading}</h1>
        <p className="text-sm text-ink-500 dark:text-ink-300 mt-2 leading-relaxed">{blurb}</p>

        <div className="mt-8 card p-4 text-left bg-ink-50/60 dark:bg-ink-700/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-400 mb-1">Coming soon</p>
          <p className="text-sm text-ink-600 dark:text-ink-300">
            This module is on our roadmap and isn't active yet. Your existing duty workflows are unaffected.
          </p>
        </div>
      </div>
    </div>
  );
}
