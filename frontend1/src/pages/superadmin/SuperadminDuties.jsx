import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ClipboardCheck, X, ExternalLink, MapPin, Clock, Phone,
  FileText, Users, CheckCircle, XCircle, RefreshCw, Calendar,
  Car, Shield, AlertTriangle, Activity, ChevronRight, User,
} from 'lucide-react';
import api from '../../api/axios';
import {
  formatDateTime, getStatusColor, getPriorityColor,
  getPriorityLabel, getDutyTypeColor, getRoleLabel,
} from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';
import Modal from '../../components/common/Modal';

// ─── Helper badges ────────────────────────────────────────────────────────────
function AttBadge({ status }) {
  const styles = {
    present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    absent:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    late:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  const labels = { present: 'Present', partial: 'Checked In', absent: 'Absent', late: 'Late' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.absent}`}>
      {labels[status] || 'Absent'}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value, className = '' }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-ink-500 dark:text-ink-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-400 dark:text-ink-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-ink-800 dark:text-ink-100 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-ink-100 dark:border-ink-800 mb-3">
      <Icon className="w-4 h-4 text-primary-500" />
      <h3 className="text-sm font-bold text-ink-900 dark:text-white uppercase tracking-wide">{title}</h3>
      {count != null && (
        <span className="ml-auto text-xs bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 px-2 py-0.5 rounded-full font-semibold">
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Full Duty Detail Modal ───────────────────────────────────────────────────
function DutyDetailModal({ dutyId, apiPrefix, onClose, showAdmin = false }) {
  const { data, isLoading } = useQuery({
    queryKey: ['duty-detail-full', apiPrefix, dutyId],
    queryFn: () => api.get(`/${apiPrefix}/duties/${dutyId}`).then(r => r.data.data),
    enabled: !!dutyId,
  });

  const duty        = data?.duty        || {};
  const attendanceMap = data?.attendanceMap || {};
  const mapsLink    = data?.mapsLink;

  const formatDur = (mins) => {
    if (!mins && mins !== 0) return '—';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const activeOfficers   = (duty.assignedOfficers || []).filter(a => a.status !== 'replaced');
  const replacedOfficers = (duty.assignedOfficers || []).filter(a => a.status === 'replaced');

  // Attendance stats
  const attValues = Object.values(attendanceMap);
  const attTotal  = activeOfficers.length;
  const attPresent = attValues.filter(a => a.status === 'present').length;
  const attPartial = attValues.filter(a => a.status === 'partial').length;
  const attAbsent  = attTotal - attPresent - attPartial;

  return (
    <Modal isOpen={!!dutyId} onClose={onClose} title="Duty Details" size="xl">
      {isLoading ? (
        <div className="py-16 flex justify-center">
          <div className="w-7 h-7 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : !duty._id ? (
        <p className="text-center py-10 text-ink-400">Could not load duty details.</p>
      ) : (
        <div className="space-y-6 pb-2">

          {/* ── Status bar ── */}
          <div className="flex items-center gap-2 flex-wrap -mt-1">
            <span className={`badge text-xs font-bold uppercase ${getStatusColor(duty.status)}`}>{duty.status}</span>
            <span className={`badge border text-xs ${getPriorityColor(duty.priority)}`}>{getPriorityLabel(duty.priority)} Priority</span>
            {duty.dutyType && <span className={`badge text-xs ${getDutyTypeColor(duty.dutyType)}`}>{duty.dutyType}</span>}
          </div>

          {/* ── Basic Info Grid ── */}
          <div>
            <SectionTitle icon={ClipboardCheck} title="Duty Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={MapPin} label="Location" value={duty.locationName} />
              {duty.location?.lat && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center shrink-0 mt-0.5">
                    <ExternalLink className="w-4 h-4 text-ink-500 dark:text-ink-400" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-400 font-medium uppercase tracking-wide">Coordinates</p>
                    <p className="text-sm text-ink-800 dark:text-ink-100 mt-0.5 font-mono text-xs">
                      {duty.location.lat.toFixed(6)}, {duty.location.lng.toFixed(6)}
                    </p>
                    {mapsLink && (
                      <a href={mapsLink} target="_blank" rel="noreferrer"
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-0.5">
                        <ExternalLink className="w-3 h-3" /> Open in Maps
                      </a>
                    )}
                  </div>
                </div>
              )}
              <InfoRow icon={Calendar} label="Start Date" value={formatDateTime(duty.startDate)} />
              <InfoRow icon={Calendar} label="End Date" value={formatDateTime(duty.endDate)} />
              {duty.vehicleNumber && <InfoRow icon={Car} label="Vehicle Number" value={duty.vehicleNumber} />}
              {duty.description && (
                <div className="sm:col-span-2">
                  <InfoRow icon={FileText} label="Description" value={duty.description} />
                </div>
              )}
            </div>
          </div>

          {/* ── Contact Numbers ── */}
          {duty.phoneNumbers?.length > 0 && (
            <div>
              <SectionTitle icon={Phone} title="Contact Numbers" count={duty.phoneNumbers.length} />
              <div className="flex flex-wrap gap-2">
                {duty.phoneNumbers.map((ph, i) => (
                  <span key={i} className="text-sm font-mono bg-ink-50 dark:bg-ink-800 text-ink-700 dark:text-ink-300 px-3 py-1.5 rounded-lg border border-ink-200 dark:border-ink-700">
                    {ph}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Hierarchy ── */}
          <div>
            <SectionTitle icon={Shield} title="Hierarchy" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {showAdmin && duty.adminRef && (
                <div className="bg-ink-50 dark:bg-ink-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold mb-1">Admin (ACP)</p>
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">{duty.adminRef.name}</p>
                  {duty.adminRef.email && <p className="text-xs text-ink-500 mt-0.5">{duty.adminRef.email}</p>}
                  {duty.adminRef.phone && <p className="text-xs text-ink-500">{duty.adminRef.phone}</p>}
                </div>
              )}
              {duty.operatorRef && (
                <div className="bg-ink-50 dark:bg-ink-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold mb-1">
                    {getRoleLabel(duty.operatorRef.role)}
                  </p>
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">{duty.operatorRef.name}</p>
                  {duty.operatorRef.email && <p className="text-xs text-ink-500 mt-0.5">{duty.operatorRef.email}</p>}
                  {duty.operatorRef.phone && <p className="text-xs text-ink-500">{duty.operatorRef.phone}</p>}
                </div>
              )}
            </div>
          </div>

          {/* ── Rank Requirements ── */}
          {duty.rankRequirements?.length > 0 && (
            <div>
              <SectionTitle icon={Users} title="Rank Requirements" count={duty.rankRequirements.length} />
              <div className="flex flex-wrap gap-2">
                {duty.rankRequirements.map((rr, i) => (
                  <div key={i} className="flex items-center gap-2 bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-700 rounded-lg px-3 py-2">
                    {rr.rankRef?.color && (
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: rr.rankRef.color }} />
                    )}
                    <span className="text-sm font-medium text-ink-800 dark:text-ink-200">
                      {rr.rankRef?.name || 'Unknown Rank'}
                    </span>
                    <span className="text-xs text-ink-400">×{rr.count}</span>
                    <span className="text-[10px] bg-ink-200 dark:bg-ink-700 text-ink-600 dark:text-ink-400 px-1.5 py-0.5 rounded font-medium uppercase">
                      {rr.assignmentType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Attendance Summary ── */}
          <div>
            <SectionTitle icon={Activity} title="Attendance" />
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: 'Total', value: attTotal, cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
                { label: 'Present', value: attPresent, cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
                { label: 'Checked In', value: attPartial, cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
                { label: 'Absent', value: Math.max(0, attAbsent), cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
              ].map(s => (
                <div key={s.label} className={`rounded-lg p-2.5 text-center ${s.cls}`}>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-[10px] font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Active Assigned Officers ── */}
          {activeOfficers.length > 0 && (
            <div>
              <SectionTitle icon={CheckCircle} title="Assigned Officers" count={activeOfficers.length} />
              <div className="overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-700">
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="bg-ink-50 dark:bg-ink-800/50">
                    <tr>
                      {['Officer', 'Rank', 'Status', 'Check-In', 'Check-Out', 'Duration', 'Attendance'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {activeOfficers.map((ao, i) => {
                      const att = ao.officerRef?._id ? attendanceMap[ao.officerRef._id.toString()] : null;
                      const attStatus = att
                        ? att.status
                        : ao.status === 'rejected' ? 'absent' : 'absent';
                      return (
                        <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-800/40">
                          <td className="px-3 py-3">
                            <p className="font-medium text-ink-900 dark:text-white">{ao.officerRef?.name || '—'}</p>
                            {ao.officerRef?.badgeNumber && (
                              <p className="text-xs text-ink-400">#{ao.officerRef.badgeNumber}</p>
                            )}
                            {ao.officerRef?.phone && (
                              <p className="text-xs text-ink-400">{ao.officerRef.phone}</p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {ao.rankRef ? (
                              <span className="text-xs px-2 py-0.5 rounded-full text-white font-semibold"
                                style={{ backgroundColor: ao.rankRef.color || '#6b7280' }}>
                                {ao.rankRef.code}
                              </span>
                            ) : '—'}
                            {ao.rankRef?.name && (
                              <p className="text-xs text-ink-400 mt-0.5">{ao.rankRef.name}</p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`badge text-xs ${getStatusColor(ao.status)}`}>{ao.status}</span>
                            {ao.rejectionReason && (
                              <p className="text-xs text-red-500 mt-0.5 max-w-[120px] truncate" title={ao.rejectionReason}>
                                {ao.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-ink-600 dark:text-ink-400 whitespace-nowrap">
                            {att?.checkedInAt ? (
                              <>
                                <p>{formatDateTime(att.checkedInAt)}</p>
                                {att.checkInDistanceMeters != null && (
                                  <p className={`${att.isWithinRadius ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {att.checkInDistanceMeters}m away
                                  </p>
                                )}
                              </>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-3 text-xs text-ink-600 dark:text-ink-400 whitespace-nowrap">
                            {att?.checkedOutAt ? formatDateTime(att.checkedOutAt) : '—'}
                          </td>
                          <td className="px-3 py-3 text-xs text-ink-600 dark:text-ink-400">
                            {formatDur(att?.durationMinutes)}
                          </td>
                          <td className="px-3 py-3">
                            <AttBadge status={att?.status || 'absent'} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Replaced Officers ── */}
          {replacedOfficers.length > 0 && (
            <div>
              <SectionTitle icon={RefreshCw} title="Replaced Officers" count={replacedOfficers.length} />
              <div className="space-y-2">
                {replacedOfficers.map((ao, i) => (
                  <div key={i} className="flex items-center gap-3 bg-ink-50 dark:bg-ink-800/40 rounded-lg p-3 border border-ink-200 dark:border-ink-700">
                    <div className="w-8 h-8 rounded-full bg-ink-200 dark:bg-ink-700 flex items-center justify-center text-ink-600 dark:text-ink-400 font-bold text-sm shrink-0">
                      {ao.officerRef?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-700 dark:text-ink-300 line-through">{ao.officerRef?.name || '—'}</p>
                      {ao.rankRef?.name && <p className="text-xs text-ink-400">{ao.rankRef.name}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink-400">Replaced by</p>
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-200">{ao.replacedBy?.name || '—'}</p>
                      {ao.replacedAt && <p className="text-xs text-ink-400">{formatDateTime(ao.replacedAt)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Documents ── */}
          {duty.documents?.length > 0 && (
            <div>
              <SectionTitle icon={FileText} title="Documents" count={duty.documents.length} />
              <div className="space-y-2">
                {duty.documents.map((doc, i) => (
                  <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline p-2 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{doc.originalName || `Document ${i + 1}`}</span>
                    <ExternalLink className="w-3 h-3 ml-auto shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Timeline / Audit Log ── */}
          {duty.timeline?.length > 0 && (
            <div>
              <SectionTitle icon={Clock} title={`Timeline / Audit Log`} count={duty.timeline.length} />
              <div className="space-y-0">
                {[...duty.timeline].reverse().map((event, i, arr) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-500 mt-1.5 shrink-0 ring-2 ring-white dark:ring-ink-900" />
                      {i < arr.length - 1 && <div className="w-0.5 flex-1 bg-ink-200 dark:bg-ink-700 mt-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="font-semibold text-ink-800 dark:text-ink-200 capitalize">
                        {event.action?.replace(/_/g, ' ') || 'Action'}
                      </p>
                      {event.note && (
                        <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{event.note}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-ink-400 font-mono">{formatDateTime(event.performedAt)}</p>
                        {event.performedBy?.name && (
                          <>
                            <span className="text-ink-300 dark:text-ink-600">·</span>
                            <p className="text-xs text-ink-400">
                              {event.performedBy.name}
                              {event.performedBy.role && (
                                <span className="ml-1 opacity-60">({getRoleLabel(event.performedBy.role)})</span>
                              )}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Metadata ── */}
          <div className="text-xs text-ink-400 dark:text-ink-600 border-t border-ink-100 dark:border-ink-800 pt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span>ID: <span className="font-mono">{duty._id}</span></span>
            {duty.createdAt && <span>Created: {formatDateTime(duty.createdAt)}</span>}
            {duty.updatedAt && <span>Updated: {formatDateTime(duty.updatedAt)}</span>}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Shared Duties Table ──────────────────────────────────────────────────────
function DutiesTable({ queryKey, queryFn, apiPrefix, showAdmin = false, showOperator = true }) {
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [selectedDutyId, setSelectedDutyId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, page, search, status],
    queryFn: () => queryFn({ page, search, status }),
  });

  const headers = [
    'Duty', 'Location',
    showAdmin && 'Admin',
    showOperator && 'Operator',
    'Priority', 'Type', 'Start', 'End', 'Officers', 'Status', 'Details',
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="Search duties..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input-field sm:w-40" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {headers.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={headers.length} className="py-10 text-center">
                  <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={headers.length} className="py-10 text-center text-gray-400 text-sm">No duties found</td></tr>
              ) : data?.data?.map(duty => (
                <tr key={duty._id} className="table-row">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedDutyId(duty._id)}
                      className="font-medium text-primary-600 dark:text-primary-400 hover:underline text-left max-w-[150px] truncate block"
                      title={duty.dutyName}
                    >
                      {duty.dutyName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate" title={duty.locationName}>{duty.locationName}</td>
                  {showAdmin && <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{duty.adminRef?.name || '—'}</td>}
                  {showOperator && <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{duty.operatorRef?.name || '—'}</td>}
                  <td className="px-4 py-3">
                    <span className={`badge border ${getPriorityColor(duty.priority)}`}>{getPriorityLabel(duty.priority)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {duty.dutyType ? <span className={`badge ${getDutyTypeColor(duty.dutyType)}`}>{duty.dutyType}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(duty.startDate)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(duty.endDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {duty.assignedOfficers?.filter(a => a.status !== 'replaced').length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedDutyId(duty._id)}
                      className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium whitespace-nowrap"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> View All
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}
      </div>

      {selectedDutyId && (
        <DutyDetailModal
          dutyId={selectedDutyId}
          apiPrefix={apiPrefix}
          onClose={() => setSelectedDutyId(null)}
          showAdmin={showAdmin}
        />
      )}
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export function SuperadminDuties() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Duties</h1>
      <DutiesTable
        queryKey={['superadmin-duties']}
        queryFn={({ page, search, status }) =>
          api.get(`/superadmin/duties?page=${page}&search=${search}&status=${status}`).then(r => r.data.data)
        }
        apiPrefix="superadmin"
        showAdmin={true}
      />
    </div>
  );
}

export function AdminDuties() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Duties</h1>
      <DutiesTable
        queryKey={['admin-duties']}
        queryFn={({ page, search, status }) =>
          api.get(`/admin/duties?page=${page}&search=${search}&status=${status}`).then(r => r.data.data)
        }
        apiPrefix="admin"
        showAdmin={false}
      />
    </div>
  );
}

export default SuperadminDuties;