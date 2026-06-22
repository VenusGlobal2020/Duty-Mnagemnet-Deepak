import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime, getStatusColor, getPriorityColor, getPriorityLabel, getDutyTypeColor } from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';

function DutiesTable({ queryKey, queryFn, showAdmin = false, showOperator = true }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, page, search, status],
    queryFn: () => queryFn({ page, search, status }),
  });

  // Same headers as before, plus "Officers" (matches the operator's own duty
  // list) so admins/superadmins can see assigned-officer counts too.
  const headers = ['Duty', 'Location', showAdmin && 'Admin', showOperator && 'Operator', 'Priority', 'Type', 'Start', 'End', 'Officers', 'Status'].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search duties..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field sm:w-40" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
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
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={headers.length} className="py-10 text-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={headers.length} className="py-10 text-center text-gray-400 text-sm">No duties found</td></tr>
              ) : data?.data?.map(duty => (
                <tr key={duty._id} className="table-row">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[150px] truncate">{duty.dutyName}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{duty.locationName}</td>
                  {showAdmin && <td className="px-4 py-3 text-gray-500">{duty.adminRef?.name || '—'}</td>}
                  {showOperator && <td className="px-4 py-3 text-gray-500">{duty.operatorRef?.name || '—'}</td>}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}
      </div>
    </div>
  );
}

export function SuperadminDuties() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Duties</h1>
      <DutiesTable
        queryKey={['superadmin-duties']}
        queryFn={({ page, search, status }) => api.get(`/superadmin/duties?page=${page}&search=${search}&status=${status}`).then(r => r.data.data)}
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
        queryFn={({ page, search, status }) => api.get(`/admin/duties?page=${page}&search=${search}&status=${status}`).then(r => r.data.data)}
      />
    </div>
  );
}

export default SuperadminDuties;