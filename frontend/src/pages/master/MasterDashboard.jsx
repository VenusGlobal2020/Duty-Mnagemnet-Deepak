import { useQuery } from '@tanstack/react-query';
import { Users, Shield, Star, UserCheck, ClipboardList, TrendingUp } from 'lucide-react';
import api from '../../api/axios';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDate } from '../../utils/helpers';

export default function MasterDashboard() {
  const { data: saData } = useQuery({
    queryKey: ['master-superadmin'],
    queryFn: () => api.get('/master/superadmin').then(r => r.data.data.superadmin),
  });
  const { data: adminsData } = useQuery({
    queryKey: ['master-admins', { page: 1, limit: 5 }],
    queryFn: () => api.get('/master/admins?limit=5').then(r => r.data.data),
  });
  const { data: ranksData } = useQuery({
    queryKey: ['master-ranks'],
    queryFn: () => api.get('/master/ranks').then(r => r.data.data.ranks),
  });
  const { data: officersData } = useQuery({
    queryKey: ['master-officers', { page: 1, limit: 1 }],
    queryFn: () => api.get('/master/officers?limit=1').then(r => r.data.data),
  });

  const totalAdmins = adminsData?.pagination?.total ?? 0;
  const activeAdmins = adminsData?.data?.filter(a => a.status === 'active').length ?? 0;
  const totalOfficers = officersData?.pagination?.total ?? 0;
  const totalRanks = ranksData?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Master Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">System overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Shield} label="Superadmin (SP)" value={saData ? 1 : 0} color="purple"
          sub={saData ? saData.status.toUpperCase() : 'Not created'} />
        <StatCard icon={Users} label="Total Admins" value={totalAdmins} color="blue"
          sub={`${activeAdmins} active`} />
        <StatCard icon={UserCheck} label="Total Officers" value={totalOfficers} color="green" />
        <StatCard icon={Star} label="Rank Types" value={totalRanks} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Superadmin info */}
        <div className="card p-5">
          <h2 className="section-title mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary-600" /> Superadmin (SP)
          </h2>
          {saData ? (
            <div className="space-y-3">
              {[
                { label: 'Name', value: saData.name },
                { label: 'Email', value: saData.email },
                { label: 'Phone', value: saData.phone },
                { label: 'Status', value: saData.status.toUpperCase() },
                { label: 'Created', value: formatDate(saData.createdAt) },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                  <span className={`font-medium ${item.label === 'Status' ? (saData.status === 'active' ? 'text-green-600' : 'text-red-600') : 'text-gray-900 dark:text-white'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No superadmin created yet</p>
            </div>
          )}
        </div>

        {/* Ranks */}
        <div className="card p-5">
          <h2 className="section-title mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-primary-600" /> Active Ranks
          </h2>
          {!ranksData ? (
            <LoadingSpinner className="py-8" />
          ) : ranksData.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No ranks created yet</div>
          ) : (
            <div className="space-y-2">
              {ranksData.map(rank => (
                <div key={rank._id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: rank.color }}
                    >
                      {rank.code}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{rank.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">Priority {rank.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Admins */}
      <div className="card">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="section-title flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-600" /> Recent Admins
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Name', 'Email', 'Phone', 'Status', 'Created'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {adminsData?.data?.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No admins yet</td></tr>
              ) : (
                adminsData?.data?.map(admin => (
                  <tr key={admin._id} className="table-row">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{admin.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{admin.email}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{admin.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${admin.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700'}`}>
                        {admin.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(admin.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
