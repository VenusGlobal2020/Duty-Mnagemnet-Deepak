import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, ChevronUp, Info } from 'lucide-react';
import api from '../../api/axios';
import { formatDate, getStatusColor } from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';

// Admin creation now belongs to the superadmin (capped by the quota the
// master grants from the Superadmin page). Master keeps full, read-only
// visibility over every admin in the system, with the same expandable
// operator/officer detail view as before.
export default function ManageAdmins() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['master-admins', page, search],
    queryFn: () => api.get(`/master/admins?page=${page}&limit=10&search=${search}`).then(r => r.data.data),
  });

  const { data: detailData } = useQuery({
    queryKey: ['admin-detail', expandedId],
    queryFn: () => api.get(`/master/admins/${expandedId}/details`).then(r => r.data.data),
    enabled: !!expandedId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admins</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Full read-only view of every admin in the system</p>
      </div>

      <div className="card p-4 border-l-4 border-blue-500 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Admins are now created by the superadmin (subject to the quota you grant from the
          <span className="font-medium"> Superadmin</span> page). This page is a read-only directory —
          suspending or activating an admin is done by the superadmin from their own Admins page.
        </p>
      </div>

      {/* Search */}
      <div className="card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by name or email..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Name', 'Email', 'Phone', 'Status', 'Created', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No admins found</td></tr>
              ) : (
                data?.data?.map(admin => (
                  <>
                    <tr key={admin._id} className="table-row">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 font-bold text-sm">
                            {admin.name[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{admin.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{admin.email}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{admin.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${getStatusColor(admin.status)}`}>{admin.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(admin.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === admin._id ? null : admin._id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                          title="View details"
                        >
                          {expandedId === admin._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {expandedId === admin._id && (
                      <tr key={`${admin._id}-detail`} className="bg-gray-50 dark:bg-gray-800/30">
                        <td colSpan={6} className="px-6 py-4">
                          {detailData ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Operators ({detailData.operators?.length || 0})</p>
                                {detailData.operators?.length === 0 ? (
                                  <p className="text-xs text-gray-400">No operators</p>
                                ) : detailData.operators?.map(op => (
                                  <div key={op._id} className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${op.role === 'operator_special' ? 'bg-blue-500' : 'bg-cyan-500'}`} />
                                    {op.name} — {op.role === 'operator_special' ? 'Special' : 'Regular'}
                                    <span className={`badge ${getStatusColor(op.status)} ml-1`}>{op.status}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="md:col-span-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Officers ({detailData.officers?.length || 0})</p>
                                <div className="flex flex-wrap gap-2">
                                  {detailData.officers?.slice(0, 10).map(off => (
                                    <span key={off._id} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
                                      {off.name}
                                    </span>
                                  ))}
                                  {detailData.officers?.length > 10 && (
                                    <span className="text-xs text-gray-400">+{detailData.officers.length - 10} more</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-2"><div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
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