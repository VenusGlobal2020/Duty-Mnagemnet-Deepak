import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api/axios';
import { formatDate, getStatusColor } from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';

export default function SuperadminAdmins() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-admins', page, search],
    queryFn: () => api.get(`/superadmin/admins?page=${page}&limit=10&search=${search}`).then(r => r.data.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['superadmin-admin-detail', expandedId],
    queryFn: () => api.get(`/superadmin/admins/${expandedId}/details`).then(r => r.data.data),
    enabled: !!expandedId,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admins (ACP)</h1>
      <div className="card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search admins..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>{['Name', 'Email', 'Phone', 'Status', 'Created', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={6} className="py-10 text-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></td></tr>
              ) : data?.data?.map(admin => (
                <>
                  <tr key={admin._id} className="table-row">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{admin.name}</td>
                    <td className="px-4 py-3 text-gray-500">{admin.email}</td>
                    <td className="px-4 py-3 text-gray-500">{admin.phone}</td>
                    <td className="px-4 py-3"><span className={`badge ${getStatusColor(admin.status)}`}>{admin.status}</span></td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(admin.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setExpandedId(expandedId === admin._id ? null : admin._id)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        {expandedId === admin._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                  {expandedId === admin._id && (
                    <tr key={`${admin._id}-d`} className="bg-gray-50 dark:bg-gray-800/20">
                      <td colSpan={6} className="px-6 py-4">
                        {detail ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Operators ({detail.operators?.length})</p>
                              {detail.operators?.map(op => (
                                <p key={op._id} className="text-xs text-gray-700 dark:text-gray-300">{op.name} — {op.role === 'operator_special' ? 'Special' : 'Regular'}</p>
                              ))}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Officers ({detail.officers?.length})</p>
                              <div className="flex flex-wrap gap-1">
                                {detail.officers?.slice(0, 8).map(o => (
                                  <span key={o._id} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">{o.name}</span>
                                ))}
                                {detail.officers?.length > 8 && <span className="text-xs text-gray-400">+{detail.officers.length - 8} more</span>}
                              </div>
                            </div>
                          </div>
                        ) : <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}
      </div>
    </div>
  );
}
