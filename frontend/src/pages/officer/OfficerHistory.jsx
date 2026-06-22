import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime, getStatusColor } from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';

const ASSIGNMENT_LABELS = {
  accepted:  { label: 'Accepted',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   Icon: CheckCircle },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           Icon: XCircle },
  replaced:  { label: 'Replaced',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', Icon: RefreshCw },
  assigned:  { label: 'Pending',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       Icon: Clock },
  unknown:   { label: 'Unknown',   color: 'bg-gray-100 text-gray-600',                                               Icon: FileText },
};

export default function OfficerHistory() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['officer-history', page],
    queryFn: () =>
      api.get(`/officer/duties/history?page=${page}&limit=10`).then(r => r.data.data),
  });

  const duties = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Duty History</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          All duties you were assigned to — including completed, rejected, and replaced
        </p>
      </div>

      {isLoading ? (
        <div className="card py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : duties.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No duty history yet</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    {['Duty', 'Location', 'Start', 'End', 'Duty Status', 'My Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {duties.map(duty => {
                    const asnInfo = ASSIGNMENT_LABELS[duty.myAssignmentStatus] || ASSIGNMENT_LABELS.unknown;
                    const { Icon } = asnInfo;
                    return (
                      <tr key={duty._id} className="table-row">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {duty.dutyName}
                          {duty.myRejectionReason && (
                            <p className="text-xs text-red-500 mt-0.5 font-normal">
                              Reason: {duty.myRejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{duty.locationName}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDateTime(duty.startDate)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDateTime(duty.endDate)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${asnInfo.color}`}>
                            <Icon className="w-3 h-3" />
                            {asnInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {duties.map(duty => {
              const asnInfo = ASSIGNMENT_LABELS[duty.myAssignmentStatus] || ASSIGNMENT_LABELS.unknown;
              const { Icon } = asnInfo;
              return (
                <div key={duty._id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{duty.dutyName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{duty.locationName}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${asnInfo.color}`}>
                      <Icon className="w-3 h-3" />
                      {asnInfo.label}
                    </span>
                  </div>
                  {duty.myRejectionReason && (
                    <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
                      Rejection reason: {duty.myRejectionReason}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>
                      <span className="text-gray-400 block">Start</span>
                      {formatDateTime(duty.startDate)}
                    </div>
                    <div>
                      <span className="text-gray-400 block">End</span>
                      {formatDateTime(duty.endDate)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400">
                      Operator: {duty.operatorRef?.name || '—'}
                    </span>
                    <span className={`badge text-xs ${getStatusColor(duty.status)}`}>
                      Duty: {duty.status}
                    </span>
                  </div>
                </div>
              );
            })}
            {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
          </div>
        </>
      )}
    </div>
  );
}
