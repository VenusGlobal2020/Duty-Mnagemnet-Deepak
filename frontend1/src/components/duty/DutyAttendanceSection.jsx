import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Download, Loader2, ArrowLeftRight, Calendar, ListChecks } from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDateTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ─── Attendance status pill ───────────────────────────────────────────────────
export function AttendanceStatusBadge({ status }) {
  const styles = {
    present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    absent:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels = { present: 'Present', partial: 'Checked In', absent: 'Absent' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.absent}`}>
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

// One officer-attendance table — reused for the single-day view and for
// every per-day block on a multi-day duty.
function AttendanceTable({ officers }) {
  if (!officers || officers.length === 0) {
    return <p className="text-sm text-ink-400 text-center py-4">No officers recorded for this day</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-ink-50 dark:bg-ink-800/50">
          <tr>
            {['Officer', 'Rank', 'Check-In', 'Check-Out', 'Duration', 'Status'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
          {officers.map((s, i) => (
            <tr key={s.assignmentId || i} className="hover:bg-ink-50 dark:hover:bg-ink-800/40 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-ink-900 dark:text-white">{s.officer?.name || '—'}</p>
                {s.officer?.badgeNumber && <p className="text-xs text-ink-400">#{s.officer.badgeNumber}</p>}
                <SwapTags swappedInFrom={s.swappedInFrom} swappedOutTo={s.swappedOutTo} />
              </td>
              <td className="px-4 py-3 text-ink-500 text-xs">{s.rank?.name || '—'}</td>
              <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400 whitespace-nowrap">
                {s.attendance?.checkedInAt ? formatDateTime(s.attendance.checkedInAt) : '—'}
                {s.attendance?.checkInDistanceMeters != null && (
                  <p className="text-ink-400">{s.attendance.checkInDistanceMeters}m away</p>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400 whitespace-nowrap">
                {s.attendance?.checkedOutAt ? formatDateTime(s.attendance.checkedOutAt) : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-ink-600 dark:text-ink-400">
                {formatDur(s.attendance?.durationMinutes)}
              </td>
              <td className="px-4 py-3">
                <AttendanceStatusBadge status={s.attendanceStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="section-title flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary-500" /> Attendance
        </h2>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium transition-colors disabled:opacity-60"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export PDF
        </button>
      </div>

      {/* Date filter — only meaningful when the duty spans more than one day */}
      {!isLoading && isMultiDay && dailyAttendance.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-ink-400 shrink-0" />
          <select
            className="input-field !w-auto text-sm py-1.5"
            value={selectedDate || dailyAttendance[0]?.date || ''}
            onChange={(e) => { setSelectedDate(e.target.value); setShowAll(false); }}
          >
            {dailyAttendance.map(d => (
              <option key={d.date} value={d.date}>{d.dayLabel}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              showAll
                ? 'bg-primary-600 text-white'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" /> Show All Attendance
          </button>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: isMultiDay && showAll ? 'Officer-Days' : 'Total', value: stats.total, cls: 'bg-signal2-50 text-signal2-700 dark:bg-signal2-900/20 dark:text-signal2-400' },
            { label: 'Present', value: stats.present, cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
            { label: 'Checked In', value: stats.partial, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
            { label: 'Absent', value: stats.absent, cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
          ].map(s => (
            <div key={s.label} className={`rounded-lg p-2.5 text-center ${s.cls}`}>
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-[11px] font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : dailyAttendance.length === 0 ? (
        <p className="text-sm text-ink-400 text-center py-4">No assigned officers found</p>
      ) : !isMultiDay ? (
        <AttendanceTable officers={dailyAttendance[0]?.officers} />
      ) : !showAll ? (
        // Single selected day
        <div className="rounded-xl border border-ink-200 dark:border-ink-700 overflow-hidden">
          <div className="bg-ink-800 dark:bg-ink-900 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold text-white">{selectedDay?.dayLabel}</span>
            <span className="text-xs text-ink-300">{selectedDay?.officers?.length || 0} officer(s) on duty</span>
          </div>
          <AttendanceTable officers={selectedDay?.officers} />
        </div>
      ) : (
        // Show All Attendance — full day-wise breakdown
        <div className="space-y-5">
          <p className="text-xs text-ink-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            This duty spans {dailyAttendance.length} days — showing exactly who was on duty each day, swaps included.
          </p>
          {dailyAttendance.map(day => (
            <div key={day.date} className="rounded-xl border border-ink-200 dark:border-ink-700 overflow-hidden">
              <div className="bg-ink-800 dark:bg-ink-900 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-semibold text-white">{day.dayLabel}</span>
                <span className="text-xs text-ink-300">{day.officers.length} officer(s) on duty</span>
              </div>
              <AttendanceTable officers={day.officers} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}