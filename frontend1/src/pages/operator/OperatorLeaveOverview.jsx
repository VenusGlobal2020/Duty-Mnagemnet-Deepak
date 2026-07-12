import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CalendarOff, Info } from 'lucide-react';
import api from '../../api/axios';
import { apiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function OperatorLeaveOverview() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['op-pending-return'],
    queryFn: () => api.get('/operator/officers/pending-return').then(r => r.data.data.officers),
  });

  const markAvailableMut = useMutation({
    mutationFn: (id) => api.patch(`/operator/officers/${id}/mark-available`),
    onSuccess: () => { toast.success('Officer marked available for duty'); qc.invalidateQueries({ queryKey: ['op-pending-return'] }); },
    onError: (err) => toast.error(apiError(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">अवकाश प्रबंधन — Leave</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Officers returned from leave, awaiting clearance for duty</p>
      </div>

      <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Officers on approved leave are automatically excluded from duty assignment. Once their leave period ends,
          they appear here until you mark them available — they won't be assigned to any duty until then.
          If an officer's leave gets approved while they're already on a duty, you'll get a notification to reassign
          that slot from the duty's detail page.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-800 dark:text-white text-sm">
          Pending Return ({data?.length || 0})
        </div>
        {isLoading ? (
          <div className="py-10 text-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></div>
        ) : data?.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            <CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-30" /> No officers awaiting return clearance
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data?.map(o => (
              <div key={o._id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{o.name} {o.badgeNumber && <span className="text-xs text-gray-400">#{o.badgeNumber}</span>}</p>
                  <p className="text-xs text-gray-500">
                    {o.rankRef?.name} {o.currentLeaveRef && <>· Leave ended {new Date(o.currentLeaveRef.toDate).toLocaleDateString('en-IN')}</>}
                  </p>
                </div>
                <button onClick={() => markAvailableMut.mutate(o._id)} disabled={markAvailableMut.isPending} className="btn-primary text-xs py-1.5 px-3">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Available
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}