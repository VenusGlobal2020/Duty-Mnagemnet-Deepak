import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Ban, CheckCircle, Eye, EyeOff } from 'lucide-react';
import api from '../../api/axios';
import { apiError, formatDate, getStatusColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

export default function ManageSuperadmin() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState({ open: false, action: null });
  const [suspendReason, setSuspendReason] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '', gender: 'male', dateOfBirth: ''
  });

  const { data: superadmin, isLoading } = useQuery({
    queryKey: ['master-superadmin'],
    queryFn: () => api.get('/master/superadmin').then(r => r.data.data.superadmin),
  });

  const createMut = useMutation({
    mutationFn: (data) => api.post('/master/superadmin', data),
    onSuccess: () => {
      toast.success('Superadmin created! Credentials sent via WhatsApp.');
      qc.invalidateQueries(['master-superadmin']);
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', password: '', confirmPassword: '', gender: 'male', dateOfBirth: '' });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const suspendMut = useMutation({
    mutationFn: ({ id, reason }) => api.patch(`/master/suspend/${id}`, { reason }),
    onSuccess: () => {
      toast.success('Superadmin suspended');
      qc.invalidateQueries(['master-superadmin']);
      setSuspendDialog({ open: false, action: null });
      setSuspendReason('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const activateMut = useMutation({
    mutationFn: (id) => api.patch(`/master/activate/${id}`),
    onSuccess: () => {
      toast.success('Superadmin activated');
      qc.invalidateQueries(['master-superadmin']);
    },
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Superadmin (SP)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Only one superadmin allowed</p>
        </div>
        {!superadmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create SP
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="card p-12 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : superadmin ? (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 font-bold text-xl">
                {superadmin.name[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{superadmin.name}</h2>
                <span className={`badge ${getStatusColor(superadmin.status)}`}>{superadmin.status.toUpperCase()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {superadmin.status === 'active' ? (
                <button
                  onClick={() => setSuspendDialog({ open: true, action: 'suspend', id: superadmin._id })}
                  className="btn-danger text-sm px-3 py-1.5"
                >
                  <Ban className="w-3.5 h-3.5" /> Suspend
                </button>
              ) : (
                <button
                  onClick={() => activateMut.mutate(superadmin._id)}
                  disabled={activateMut.isPending}
                  className="btn-primary text-sm px-3 py-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Activate
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Email', value: superadmin.email },
              { label: 'Phone', value: superadmin.phone },
              { label: 'Gender', value: superadmin.gender },
              { label: 'Date of Birth', value: formatDate(superadmin.dateOfBirth) },
              { label: 'Created', value: formatDate(superadmin.createdAt) },
              { label: 'Last Login', value: formatDate(superadmin.lastLogin) || 'Never' },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{item.label}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>

          {superadmin.suspendReason && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">
                <span className="font-medium">Suspension reason:</span> {superadmin.suspendReason}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No superadmin created yet</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" /> Create Superadmin
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Superadmin (SP)">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name *</label>
              <input className="input-field" placeholder="SP Name" value={form.name} onChange={f('name')} required />
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input type="email" className="input-field" placeholder="sp@police.gov.in" value={form.email} onChange={f('email')} required />
            </div>
            <div>
              <label className="form-label">Phone (10-digit) *</label>
              <input className="input-field" placeholder="98XXXXXXXX" maxLength={10} value={form.phone} onChange={f('phone')} required />
            </div>
            <div>
              <label className="form-label">Gender *</label>
              <select className="input-field" value={form.gender} onChange={f('gender')} required>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Date of Birth *</label>
              <input type="date" className="input-field" value={form.dateOfBirth} onChange={f('dateOfBirth')} required />
            </div>
            <div>
              <label className="form-label">Password *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input-field pr-10" placeholder="Min 8 chars" value={form.password} onChange={f('password')} required />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Confirm Password *</label>
              <input type="password" className="input-field" placeholder="Repeat password" value={form.confirmPassword} onChange={f('confirmPassword')} required />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">
              {createMut.isPending ? 'Creating...' : 'Create Superadmin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Suspend Dialog */}
      <Modal isOpen={suspendDialog.open && suspendDialog.action === 'suspend'} onClose={() => setSuspendDialog({ open: false, action: null })} title="Suspend Superadmin" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">This will also suspend all admins and operators under this superadmin.</p>
          <div>
            <label className="form-label">Reason for Suspension *</label>
            <textarea className="input-field" rows={3} placeholder="Enter reason..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSuspendDialog({ open: false, action: null })} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => { if (!suspendReason.trim()) { toast.error('Reason required'); return; } suspendMut.mutate({ id: suspendDialog.id, reason: suspendReason }); }}
              disabled={suspendMut.isPending}
              className="btn-danger flex-1"
            >
              {suspendMut.isPending ? 'Suspending...' : 'Suspend'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
