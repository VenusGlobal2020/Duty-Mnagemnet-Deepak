import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, UserCheck } from 'lucide-react';
import api from '../../api/axios';
import { getStatusColor } from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';
import OfficerDetailModal from '../../components/officer/OfficerDetailModal';

const AVAILABILITY_BADGE = {
  available: null, // don't clutter the row for the common case
  on_leave: { label: 'On Leave', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  pending_return: { label: 'Pending Return', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

export default function SuperadminOfficers() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [adminId, setAdminId] = useState('');
  const [rankId, setRankId] = useState('');
  const [thana, setThana] = useState('');
  const [zone, setZone] = useState('');
  // Pre-filled when arriving from the dashboard's "On Leave Today" stat card.
  const [availability, setAvailability] = useState(searchParams.get('availability') || '');
  const [status, setStatus] = useState('');
  const [viewTarget, setViewTarget] = useState(null);

  const { data: admins = [] } = useQuery({
    queryKey: ['sa-admins-all'],
    queryFn: () => api.get('/superadmin/admins?limit=100').then(r => r.data.data.data),
  });

  const { data: locations } = useQuery({
    queryKey: ['sa-officer-locations', adminId],
    queryFn: () => api.get(`/superadmin/officers/locations${adminId ? `?adminId=${adminId}` : ''}`).then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sa-officers', page, search, adminId, rankId, thana, zone, availability, status],
    queryFn: () => api.get('/superadmin/officers', {
      params: { page, limit: 15, search, adminId, rankId, thana, zone, availability, status },
    }).then(r => r.data.data),
  });

  const resetPage = (setter) => (e) => { setter(e.target.value); setPage(1); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">सभी अधिकारी — All Officers</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Every officer under your admins — filter and click a row for full details.</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by name or badge..." value={search} onChange={resetPage(setSearch)} />
        </div>
        <select className="input-field sm:w-52" value={adminId} onChange={resetPage(setAdminId)}>
          <option value="">All Admins</option>
          {admins.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
        <select className="input-field sm:w-44" value={rankId} onChange={resetPage(setRankId)}>
          <option value="">All Ranks</option>
          {locations?.ranks?.map(r => <option key={r._id} value={r._id}>{r.code} — {r.name}</option>)}
        </select>
        <select className="input-field sm:w-40" value={thana} onChange={resetPage(setThana)}>
          <option value="">All Thana</option>
          {locations?.thanas?.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input-field sm:w-40" value={zone} onChange={resetPage(setZone)}>
          <option value="">All Zones</option>
          {locations?.zones?.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <select className="input-field sm:w-44" value={availability} onChange={resetPage(setAvailability)}>
          <option value="">Any Availability</option>
          <option value="available">Available</option>
          <option value="on_leave">On Leave</option>
          <option value="pending_return">Pending Return</option>
        </select>
        <select className="input-field sm:w-36" value={status} onChange={resetPage(setStatus)}>
          <option value="">Any Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Officer', 'Badge', 'Rank', 'Thana', 'Zone', 'Admin', 'Availability', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10">
                  <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No officers found</p>
                </td></tr>
              ) : (
                data?.data?.map(officer => {
                  const avail = AVAILABILITY_BADGE[officer.dutyAvailability];
                  return (
                    <tr key={officer._id} onClick={() => setViewTarget(officer)} className="table-row cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{ backgroundColor: officer.rankRef?.color || '#6b7280' }}
                          >
                            {officer.name[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{officer.name}</p>
                            <p className="text-xs text-gray-400 truncate">{officer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{officer.badgeNumber || '—'}</td>
                      <td className="px-4 py-3">
                        {officer.rankRef ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: officer.rankRef.color }}>
                            {officer.rankRef.code} — {officer.rankRef.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{officer.thana || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{officer.zone || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{officer.adminRef?.name || '—'}</td>
                      <td className="px-4 py-3">
                        {avail ? <span className={`badge ${avail.cls}`}>{avail.label}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><span className={`badge ${getStatusColor(officer.status)}`}>{officer.status}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}
      </div>

      <OfficerDetailModal isOpen={!!viewTarget} onClose={() => setViewTarget(null)} officer={viewTarget} showAdmin />
    </div>
  );
}