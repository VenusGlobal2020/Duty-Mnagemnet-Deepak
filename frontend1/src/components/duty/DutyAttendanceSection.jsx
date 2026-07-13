import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck, Download, Loader2, ArrowLeftRight, Calendar, ListChecks, Route,
  Users, CheckCircle2, Clock3, XCircle, MapPin, UserX,
} from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDateTime } from '../../utils/helpers';
import toast from 'react-hot-toast';
import TrackMapModal from '../common/TrackMapModal';

// ─── Attendance status pill ───────────────────────────────────────────────────
export function AttendanceStatusBadge({ status }) {
  const styles = {
    present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    absent:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels = { present: 'Present', partial: 'Checked In', absent: 'Absent' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.absent}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {labels[status] || 'Absent'}
    </span>
  );
}

// ─── Unique, unmissable swap indicator ────────────────────────────────────────
// Shown right under an officer's name whenever their slot on this duty was
// touched by a swap — in either direction — so a swap is obvious at a
// glance instead of the officer just quietly vanishing from the list.
function SwapTags({ swappedInFrom, swappedOutTo }) {
  if (!swappedInFrom && !swappedOutTo) return null;
  return (
    <div className="flex flex-col gap-1 mt-1.5">
      {swappedInFrom && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 w-fit">
          <ArrowLeftRight className="w-3 h-3 shrink-0" />
          SWAPPED IN — replaced {swappedInFrom.officer?.name || 'officer'} · {formatDateTime(swappedInFrom.at)}
        </span>
      )}
      {swappedOutTo && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 w-fit">
          <ArrowLeftRight className="w-3 h-3 shrink-0" />
          SWAPPED OUT — replaced by {swappedOutTo.officer?.name || 'officer'} · {formatDateTime(swappedOutTo.at)}
        </span>
      )}
    </div>
  );
}

function formatDur(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Local YYYY-MM-DD for "today", matching the date-string format the backend
// uses for `dailyAttendance[].date` — so the default selection lines up.
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Small deterministic accent picker for officer avatars — same officer always
// gets the same tone, just for a bit of visual variety instead of one flat color.
const AVATAR_TONES = [
  'from-signal-500 to-signal-600',
  'from-signal2-500 to-signal2-600',
  'from-violet-500 to-violet-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-teal-500 to-teal-600',
];
function avatarTone(name = '') {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}
function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function OfficerIdentity({ officer, swappedInFrom, swappedOutTo }) {
  const name = officer?.name || '—';
  return (
    <div className="flex items-start gap-2.5">
      <div className={`shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${avatarTone(name)} flex items-center justify-center text-[11px] font-bold text-white shadow-sm`}>
        {initials(name)}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-ink-900 dark:text-white truncate">{name}</p>
        {officer?.badgeNumber && <p className="text-xs text-ink-400">#{officer.badgeNumber}</p>}
        <SwapTags swappedInFrom={swappedInFrom} swappedOutTo={swappedOutTo} />
      </div>
    </div>
  );
}

function TrackButton({ shift, officerName, onTrackClick }) {
  if (!(shift?._id && shift?.checkedInAt)) {
    return <span className="text-xs text-ink-300 dark:text-ink-600">—</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onTrackClick(shift._id, officerName)}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-signal2-700 dark:text-signal2-400 bg-signal2-50 dark:bg-signal2-900/20 hover:bg-signal2-100 dark:hover:bg-signal2-900/40 transition-colors whitespace-nowrap"
    >
      <Route className="w-3.5 h-3.5" /> View Track
    </button>
  );
}

// One officer-attendance table — reused for the single-day view and for
// every per-day block on a multi-day duty. Renders as a proper table on
// medium+ screens and collapses into stacked cards on small screens so
// nothing gets cramped or forces awkward horizontal scrolling on mobile.
// `onTrackClick(attendanceId, officerName)` opens the route map for that
// officer's shift on this table's date — only shown once they've actually
// checked in (nothing to track before that).
function AttendanceTable({ officers, onTrackClick }) {
  if (!officers || officers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
          <UserX className="w-5 h-5 text-ink-400" />
        </div>
        <p className="text-sm text-ink-400">No officers recorded for this day</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet — full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50/80 dark:bg-ink-800/50 backdrop-blur-sm">
            <tr>
              {['Officer', 'Rank', 'Check-In', 'Check-Out', 'Duration', 'Status', 'Track'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {officers.map((s, i) => (
              <tr key={s.assignmentId || i} className="group hover:bg-signal-50/50 dark:hover:bg-ink-700/30 transition-colors">
                <td className="px-4 py-3">
                  <OfficerIdentity officer={s.officer} swappedInFrom={s.swappedInFrom} swappedOutTo={s.swappedOutTo} />
                </td>
                <td className="px-4 py-3 text-ink-500 dark:text-ink-400 text-xs font-medium">{s.rank?.name || '—'}</td>
                <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400 whitespace-nowrap">
                  {s.attendance?.checkedInAt ? formatDateTime(s.attendance.checkedInAt) : '—'}
                  {s.attendance?.checkInDistanceMeters != null && (
                    <p className="text-ink-400 flex items-center gap-0.5 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" /> {s.attendance.checkInDistanceMeters}m away
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400 whitespace-nowrap">
                  {s.attendance?.checkedOutAt ? formatDateTime(s.attendance.checkedOutAt) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400 font-medium whitespace-nowrap">
                  {formatDur(s.attendance?.durationMinutes)}
                </td>
                <td className="px-4 py-3">
                  <AttendanceStatusBadge status={s.attendanceStatus} />
                </td>
                <td className="px-4 py-3">
                  <TrackButton shift={s.attendance} officerName={s.officer?.name} onTrackClick={onTrackClick} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — stacked cards */}
      <div className="md:hidden divide-y divide-ink-100 dark:divide-ink-800">
        {officers.map((s, i) => (
          <div key={s.assignmentId || i} className="p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <OfficerIdentity officer={s.officer} swappedInFrom={s.swappedInFrom} swappedOutTo={s.swappedOutTo} />
              <AttendanceStatusBadge status={s.attendanceStatus} />
            </div>
            <div className="grid grid-cols-3 gap-2 pl-[42px]">
              <div>
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">In</p>
                <p className="text-xs text-ink-700 dark:text-ink-300 font-medium">
                  {s.attendance?.checkedInAt ? formatDateTime(s.attendance.checkedInAt) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Out</p>
                <p className="text-xs text-ink-700 dark:text-ink-300 font-medium">
                  {s.attendance?.checkedOutAt ? formatDateTime(s.attendance.checkedOutAt) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Duration</p>
                <p className="text-xs text-ink-700 dark:text-ink-300 font-medium">{formatDur(s.attendance?.durationMinutes)}</p>
              </div>
            </div>
            <div className="pl-[42px]">
              <TrackButton shift={s.attendance} officerName={s.officer?.name} onTrackClick={onTrackClick} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Compact stat tile ─────────────────────────────────────────────────────────
function StatTile({ icon: Icon, label, value, tone }) {
  const tones = {
    total:   { bg: 'bg-signal2-50 dark:bg-signal2-900/10', border: 'border-signal2-100 dark:border-signal2-800/40', text: 'text-signal2-700 dark:text-signal2-400', iconBg: 'bg-signal2-500' },
    present: { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-100 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-400', iconBg: 'bg-emerald-500' },
    partial: { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-100 dark:border-amber-800/40', text: 'text-amber-700 dark:text-amber-400', iconBg: 'bg-amber-500' },
    absent:  { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-100 dark:border-red-800/40', text: 'text-red-700 dark:text-red-400', iconBg: 'bg-red-500' },
  };
  const t = tones[tone] || tones.total;
  return (
    <div className={`relative rounded-xl border ${t.border} ${t.bg} p-3 sm:p-3.5 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xl sm:text-2xl font-bold font-display leading-none ${t.text}`}>{value}</p>
          <p className="text-[10px] sm:text-[11px] font-semibold text-ink-500 dark:text-ink-400 mt-1 truncate">{label}</p>
        </div>
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${t.iconBg} shadow-sm`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Day tab — segmented, horizontally-scrollable selector ────────────────────
function DayTab({ active, onClick, children, accent = 'signal' }) {
  const activeCls = accent === 'signal2'
    ? 'bg-gradient-to-b from-signal2-500 to-signal2-600 text-white border-transparent shadow-glow-cyan'
    : 'bg-gradient-to-b from-signal-500 to-signal-600 text-white border-transparent shadow-glow-signal';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all duration-150 active:scale-[0.97] ${
        active ? activeCls : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-700 hover:border-signal-300 dark:hover:border-signal-500/50'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Day section header — used above each per-day table ───────────────────────
function DaySectionHeader({ label, count }) {
  return (
    <div className="relative bg-gradient-to-r from-signal-600 via-signal-600 to-signal2-600 dark:from-ink-900 dark:via-signal-900 dark:to-ink-900 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 overflow-hidden">
      <div className="absolute inset-0 bg-grid-faint-dark opacity-30 pointer-events-none" />
      <span className="relative flex items-center gap-2 text-sm font-semibold text-white">
        <Calendar className="w-3.5 h-3.5 opacity-80" /> {label}
      </span>
      <span className="relative text-xs font-medium text-white/80 bg-white/10 border border-white/15 rounded-full px-2.5 py-0.5">
        {count} officer{count === 1 ? '' : 's'} on duty
      </span>
    </div>
  );
}

// ─── Dedicated Attendance section ─────────────────────────────────────────────
// Swap-aware (every officer who ever actually served shows up, including
// anyone swapped in/out mid-duty). For multi-day duties this now defaults to
// showing just today's attendance, with a date filter (built from the duty's
// own start/end date range) to jump to any other day, plus a "Show All
// Attendance" button to fall back to the full day-wise breakdown. The PDF
// export separately always shows the full day-wise breakdown.
export default function DutyAttendanceSection({ dutyId }) {
  const [exporting, setExporting] = useState(false);
  // null = not yet defaulted; a 'YYYY-MM-DD' string once a day is selected
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const defaultedRef = useRef(false);

  // { attendanceId, officerName } | null — drives the TrackMapModal
  const [trackTarget, setTrackTarget] = useState(null);
  const openTrack = (attendanceId, officerName) => setTrackTarget({ attendanceId, officerName });

  const { data: attData, isLoading } = useQuery({
    queryKey: ['duty-attendance', dutyId],
    queryFn: () => api.get(`/attendance/duty/${dutyId}`).then(r => r.data.data),
  });

  const dailyAttendance = attData?.dailyAttendance || [];
  const isMultiDay = !!attData?.isMultiDay;

  // Default to today's date the first time day-wise data loads (falls back
  // to the duty's first day if today isn't within the duty's date range).
  useEffect(() => {
    if (!defaultedRef.current && dailyAttendance.length > 0) {
      defaultedRef.current = true;
      const match = dailyAttendance.find(d => d.date === todayKey());
      setSelectedDate(match ? match.date : dailyAttendance[0].date);
    }
  }, [dailyAttendance]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const base = api.defaults.baseURL || '';
      const url = `${base}/attendance/duty/${dutyId}/export-pdf`;
      const win = window.open('about:blank', '_blank');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const html = await res.text();
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setExporting(false);
    }
  };

  const selectedDay = dailyAttendance.find(d => d.date === selectedDate) || dailyAttendance[0] || null;

  // Stats reflect whatever's currently on screen: the selected day only, or
  // every day combined when "Show All Attendance" is active.
  const visibleOfficers = isMultiDay && !showAll ? (selectedDay?.officers || []) : dailyAttendance.flatMap(d => d.officers);
  const stats = {
    total: visibleOfficers.length,
    present: visibleOfficers.filter(o => o.attendanceStatus === 'present').length,
    partial: visibleOfficers.filter(o => o.attendanceStatus === 'partial').length,
    absent: visibleOfficers.filter(o => o.attendanceStatus === 'absent').length,
  };
  const attendanceRate = stats.total > 0 ? Math.round(((stats.present + stats.partial) / stats.total) * 100) : 0;

  return (
    <div className="card p-4 sm:p-5 space-y-4 animate-fadeUp">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-signal-500 to-signal-600 shadow-glow-signal shrink-0">
            <ClipboardCheck className="w-4 h-4 text-white" />
          </span>
          <div>
            <h2 className="section-title">Attendance</h2>
            <p className="text-[11px] text-ink-400">Live check-in / check-out tracking for this duty</p>
          </div>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="btn-primary text-sm py-2 px-3.5 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export PDF
        </button>
      </div>

      {/* Date filter — only meaningful when the duty spans more than one day */}
      {!isLoading && isMultiDay && dailyAttendance.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
          {dailyAttendance.map(d => (
            <DayTab key={d.date} active={!showAll && selectedDate === d.date} onClick={() => { setSelectedDate(d.date); setShowAll(false); }}>
              {d.dayLabel}
            </DayTab>
          ))}
          <DayTab active={showAll} onClick={() => setShowAll(true)} accent="signal2">
            <ListChecks className="w-3.5 h-3.5" /> All Days
          </DayTab>
        </div>
      )}

      {/* Stats */}
      {!isLoading && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            <StatTile icon={Users} tone="total" label={isMultiDay && showAll ? 'Officer-Days' : 'Total'} value={stats.total} />
            <StatTile icon={CheckCircle2} tone="present" label="Present" value={stats.present} />
            <StatTile icon={Clock3} tone="partial" label="Checked In" value={stats.partial} />
            <StatTile icon={XCircle} tone="absent" label="Absent" value={stats.absent} />
          </div>
          {stats.total > 0 && (
            <div className="flex items-center gap-3 px-0.5">
              <div className="flex-1 h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-signal-500 to-signal2-500 transition-all duration-500"
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-ink-500 dark:text-ink-400 whitespace-nowrap">{attendanceRate}% turned up</span>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-[62px] rounded-xl" />)}
          </div>
          <div className="skeleton h-40 rounded-xl" />
        </div>
      ) : dailyAttendance.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
            <UserX className="w-5 h-5 text-ink-400" />
          </div>
          <p className="text-sm text-ink-400">No assigned officers found</p>
        </div>
      ) : !isMultiDay ? (
        <div className="rounded-xl border border-ink-200 dark:border-ink-700 overflow-hidden">
          <AttendanceTable officers={dailyAttendance[0]?.officers} onTrackClick={openTrack} />
        </div>
      ) : !showAll ? (
        // Single selected day
        <div className="rounded-xl border border-ink-200 dark:border-ink-700 overflow-hidden">
          <DaySectionHeader label={selectedDay?.dayLabel} count={selectedDay?.officers?.length || 0} />
          <AttendanceTable officers={selectedDay?.officers} onTrackClick={openTrack} />
        </div>
      ) : (
        // Show All Attendance — full day-wise breakdown
        <div className="space-y-4">
          <p className="text-xs text-ink-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            This duty spans {dailyAttendance.length} days — showing exactly who was on duty each day, swaps included.
          </p>
          {dailyAttendance.map(day => (
            <div key={day.date} className="rounded-xl border border-ink-200 dark:border-ink-700 overflow-hidden">
              <DaySectionHeader label={day.dayLabel} count={day.officers.length} />
              <AttendanceTable officers={day.officers} onTrackClick={openTrack} />
            </div>
          ))}
        </div>
      )}

      {trackTarget && (
        <TrackMapModal
          attendanceId={trackTarget.attendanceId}
          officerName={trackTarget.officerName}
          onClose={() => setTrackTarget(null)}
        />
      )}
    </div>
  );
}