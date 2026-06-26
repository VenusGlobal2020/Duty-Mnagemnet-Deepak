import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserCheck } from 'lucide-react';
import api from '../../api/axios';
import { formatDate, getStatusColor } from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';

export default function MasterOfficers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [adminId, setAdminId] = useState('');

  const { data: admins = [] } = useQuery({
    queryKey: ['master-admins-all'],
    queryFn: () => api.get('/master/admins?limit=100').then(r => r.data.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['master-officers', page, search, adminId],
    queryFn: () => api.get(`/master/officers?page=${page}&limit=15&search=${search}&adminId=${adminId}`).then(r => r.data.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Officers</h1>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by name or badge..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field sm:w-56" value={adminId} onChange={e => { setAdminId(e.target.value); setPage(1); }}>
          <option value="">All Admins</option>
          {admins.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Officer', 'Badge', 'Rank', 'Admin', 'Phone', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10">
                  <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No officers found</p>
                </td></tr>
              ) : (
                data?.data?.map(officer => (
                  <tr key={officer._id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 font-bold text-xs">
                          {officer.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{officer.name}</p>
                          <p className="text-xs text-gray-400">{officer.email}</p>
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
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{officer.adminRef?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{officer.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusColor(officer.status)}`}>{officer.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}
      </div>
    </div>
  );
}
