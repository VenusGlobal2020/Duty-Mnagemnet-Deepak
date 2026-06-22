import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime, getStatusColor } from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';

export default function OfficerHistory() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['officer-history', page],
    queryFn: () => api.get(`/officer/duties/history?page=${page}&limit=10`).then(r => r.data.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Duty History</h1>

      {isLoading ? (
        <div className="card py-12 flex justify-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : data?.data?.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No duty history yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>{['Duty', 'Location', 'Start', 'End', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.data.map(duty => (
                  <tr key={duty._id} className="table-row">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{duty.dutyName}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{duty.locationName}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(duty.startDate)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(duty.endDate)}</td>
                    <td className="px-4 py-3"><span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}
