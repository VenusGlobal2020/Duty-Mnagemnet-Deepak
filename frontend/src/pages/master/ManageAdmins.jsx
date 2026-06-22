import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Ban, CheckCircle, Eye, EyeOff, Search, ChevronDown, ChevronUp, Users } from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDate, getStatusColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', email: '', phone: '', password: '', confirmPassword: '', gender: 'male', dateOfBirth: '' };

export default function ManageAdmins() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [suspendModal, setSuspendModal] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['master-admins', page, search],
    queryFn: () => api.get(`/master/admins?page=${page}&limit=10&search=${search}`).then(r => r.data.data),
  });

  const { data: detailData } = useQuery({
    queryKey: ['admin-detail', expandedId],
    queryFn: () => api.get(`/master/admins/${expandedId}/details`).then(r => r.data.data),
    enabled: !!expandedId,
  });

  const createMut = useMutation({
    mutationFn: (d) => api.post('/master/admins', d),
    onSuccess: () => {
      toast.success('Admin created! Credentials sent via WhatsApp.');
      qc.invalidateQueries(['master-admins']);
      setShowModal(false); setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const suspendMut = useMutation({
    mutationFn: ({ id, reason }) => api.patch(`/master/suspend/${id}`, { reason }),
    onSuccess: () => {
      toast.success('Admin suspended'); qc.invalidateQueries(['master-admins']);
      setSuspendModal(null); setSuspendReason('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const activateMut = useMutation({
    mutationFn: (id) => api.patch(`/master/activate/${id}`),
    onSuccess: () => { toast.success('Admin activated'); qc.invalidateQueries(['master-admins']); },
    onError: (err) => toast.error(apiError(err)),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!/^[6-9]\d{9}$/.test(form.phone)) { toast.error('Enter valid 10-digit phone number'); return; }
    createMut.mutate(form);
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admins (ACP)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage all ACP-level admins</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Admin
        </button>
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
                {['Name', 'Email', 'Phone', 'Status', 'Created', 'Actions'].map(h => (
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedId(expandedId === admin._id ? null : admin._id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                            title="View details"
                          >
                            {expandedId === admin._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {admin.status === 'active' ? (
                            <button onClick={() => setSuspendModal(admin)} className="btn-danger text-xs px-2 py-1">
                              <Ban className="w-3 h-3" /> Suspend
                            </button>
                          ) : (
                            <button onClick={() => activateMut.mutate(admin._id)} disabled={activateMut.isPending} className="btn-primary text-xs px-2 py-1">
                              <CheckCircle className="w-3 h-3" /> Activate
                            </button>
                          )}
                        </div>
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

      {/* Create Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setForm(EMPTY_FORM); }} title="Create Admin (ACP)">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Full Name *</label><input className="input-field" placeholder="ACP Name" value={form.name} onChange={f('name')} required /></div>
            <div><label className="form-label">Email *</label><input type="email" className="input-field" placeholder="acp@police.gov.in" value={form.email} onChange={f('email')} required /></div>
            <div><label className="form-label">Phone (10-digit) *</label><input className="input-field" placeholder="98XXXXXXXX" maxLength={10} value={form.phone} onChange={f('phone')} required /></div>
            <div><label className="form-label">Gender *</label>
              <select className="input-field" value={form.gender} onChange={f('gender')} required>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
            <div><label className="form-label">Date of Birth *</label><input type="date" className="input-field" value={form.dateOfBirth} onChange={f('dateOfBirth')} required /></div>
            <div><label className="form-label">Password *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input-field pr-10" placeholder="Min 8 chars" value={form.password} onChange={f('password')} required />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2"><label className="form-label">Confirm Password *</label><input type="password" className="input-field" placeholder="Repeat password" value={form.confirmPassword} onChange={f('confirmPassword')} required /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">{createMut.isPending ? 'Creating...' : 'Create Admin'}</button>
          </div>
        </form>
      </Modal>

      {/* Suspend Modal */}
      <Modal isOpen={!!suspendModal} onClose={() => setSuspendModal(null)} title={`Suspend ${suspendModal?.name}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">This will also suspend all operators and officers under this admin.</p>
          <div><label className="form-label">Reason *</label><textarea className="input-field" rows={3} placeholder="Enter reason..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} /></div>
          <div className="flex gap-3">
            <button onClick={() => setSuspendModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => { if (!suspendReason.trim()) { toast.error('Reason required'); return; } suspendMut.mutate({ id: suspendModal._id, reason: suspendReason }); }} disabled={suspendMut.isPending} className="btn-danger flex-1">
              {suspendMut.isPending ? 'Suspending...' : 'Suspend'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
