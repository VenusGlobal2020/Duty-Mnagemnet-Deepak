import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, ClipboardList, ClipboardCheck, Loader2, Download } from 'lucide-react';
import api from '../../api/axios';
import {
  formatDateTime, getStatusColor, getPriorityColor,
  getPriorityLabel, getDutyTypeColor, truncate, apiError
} from '../../utils/helpers';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

// Inline mini attendance badge
function MiniAttStats({ dutyId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['duty-att-mini', dutyId],
    queryFn: () => api.get(`/attendance/duty/${dutyId}`).then(r => r.data.data.stats),
    staleTime: 60000,
  });

  if (isLoading) return <Loader2 className="w-3 h-3 animate-spin text-gray-400" />;
  if (!data) return <span className="text-xs text-gray-400">—</span>;

  return (
    <div className="flex items-center gap-1 text-xs font-medium">
      <span className="text-green-600">{data.present}P</span>
      <span className="text-gray-300">/</span>
      <span className="text-yellow-600">{data.partial}C</span>
      <span className="text-gray-300">/</span>
      <span className="text-red-500">{data.absent}A</span>
    </div>
  );
}

export default function ManageDuties() {
  const navigate = useNavigate();
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [priority, setPriority] = useState('');
  const [exportingId, setExportingId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['op-duties', page, search, status, priority],
    queryFn: () =>
      api.get(`/operator/duties?page=${page}&limit=10&search=${search}&status=${status}&priority=${priority}`)
        .then(r => r.data.data),
  });

  const handleExportPDF = async (e, dutyId) => {
    e.stopPropagation();
    setExportingId(dutyId);
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
      setExportingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Duties</h1>
        <button onClick={() => navigate('/operator/duties/create')} className="btn-primary">
          <Plus className="w-4 h-4" /> New Duty
        </button>
      </div>

      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search duties..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field sm:w-36" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input-field sm:w-36" value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}>
          <option value="">All Priority</option>
          <option value="1">Critical</option><option value="2">High</option>
          <option value="3">Medium</option><option value="4">Low</option><option value="5">Minimal</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Duty Name', 'Location', 'Priority', 'Type', 'Start', 'End', 'Officers', 'Attendance', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={10} className="py-10 text-center">
                  <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={10} className="py-10 text-center">
                  <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No duties found</p>
                </td></tr>
              ) : (
                data?.data?.map(duty => (
                  <tr
                    key={duty._id}
                    className="table-row cursor-pointer"
                    onClick={() => navigate(`/operator/duties/${duty._id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{truncate(duty.dutyName, 25)}</td>
                    <td className="px-4 py-3 text-gray-500">{truncate(duty.locationName, 20)}</td>
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
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <MiniAttStats dutyId={duty._id} />
                        <button
                          onClick={(e) => handleExportPDF(e, duty._id)}
                          disabled={exportingId === duty._id}
                          className="flex items-center gap-0.5 text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                          title="Export attendance PDF"
                        >
                          {exportingId === duty._id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Download className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-primary-600 hover:underline">View →</span>
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