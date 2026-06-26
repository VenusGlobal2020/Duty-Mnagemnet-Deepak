import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Eye, EyeOff } from 'lucide-react';
import api from '../../api/axios';
import { apiError, getRoleLabel, getStatusColor, formatDate } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const EMPTY = { name: '', email: '', phone: '', password: '', confirmPassword: '', gender: 'male', dateOfBirth: '', operatorType: '' };

export default function AdminOperators() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editForm, setEditForm] = useState({ name: '', phone: '', newPassword: '' });
  const [showPass, setShowPass] = useState(false);

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ['admin-operators'],
    queryFn: () => api.get('/admin/operators').then(r => r.data.data.operators),
  });

  const hasSpecial = operators.some(o => o.role === 'operator_special');
  const hasRegular = operators.some(o => o.role === 'operator_regular');

  const openCreate = () => {
    const defaultType = !hasSpecial ? 'operator_special' : !hasRegular ? 'operator_regular' : '';
    setForm({ ...EMPTY, operatorType: defaultType });
    setShowCreate(true);
  };

  const createMut = useMutation({
    mutationFn: (d) => api.post('/admin/operators', d),
    onSuccess: () => {
      toast.success('Operator created! Credentials sent via WhatsApp.');
      qc.invalidateQueries(['admin-operators']); setShowCreate(false); setForm(EMPTY);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/operators/${id}`, data),
    onSuccess: () => {
      toast.success('Operator updated'); qc.invalidateQueries(['admin-operators']); setEditTarget(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.operatorType) { toast.error('No operator slot available'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password min 8 chars'); return; }
    if (!/^[6-9]\d{9}$/.test(form.phone)) { toast.error('Invalid phone'); return; }
    createMut.mutate(form);
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const ef = (k) => (e) => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const openEdit = (op) => { setEditTarget(op); setEditForm({ name: op.name, phone: op.phone, newPassword: '' }); };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Operators</h1>
        {(!hasSpecial || !hasRegular) && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Operator
          </button>
        )}
      </div>

      {/* Quota info */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Special Operator', used: hasSpecial, role: 'operator_special' },
          { label: 'Regular Operator', used: hasRegular, role: 'operator_regular' },
        ].map(slot => (
          <div key={slot.role} className={`card p-4 border-l-4 ${slot.used ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{slot.label}</p>
            <p className={`text-xs mt-0.5 ${slot.used ? 'text-green-600' : 'text-gray-400'}`}>
              {slot.used ? '✓ Created (1/1)' : 'Not created yet (0/1)'}
            </p>
          </div>
        ))}
      </div>

      {/* Operators list */}
      {isLoading ? (
        <div className="card py-12 flex justify-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : operators.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 text-sm">No operators created yet</div>
      ) : (
        <div className="space-y-3">
          {operators.map(op => (
            <div key={op._id} className="card p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${op.role === 'operator_special' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600'}`}>
                  {op.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{op.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{op.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${op.role === 'operator_special' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'}`}>
                      {op.role === 'operator_special' ? 'Special' : 'Regular'}
                    </span>
                    <span className={`badge ${getStatusColor(op.status)}`}>{op.status}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => openEdit(op)} className="btn-secondary text-sm px-3 py-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setForm(EMPTY); }} title="Add Operator">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="form-label">Operator Type *</label>
            <select className="input-field" value={form.operatorType} onChange={f('operatorType')}>
              {!hasSpecial && <option value="operator_special">Special Operator</option>}
              {!hasRegular && <option value="operator_regular">Regular Operator</option>}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {form.operatorType === 'operator_special' ? 'Can create VVIP/CRIMINAL/CITY-POINT duties' : 'Can create duties (no duty type selection)'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Full Name *</label><input className="input-field" value={form.name} onChange={f('name')} required /></div>
            <div><label className="form-label">Email *</label><input type="email" className="input-field" value={form.email} onChange={f('email')} required /></div>
            <div><label className="form-label">Phone *</label><input className="input-field" maxLength={10} value={form.phone} onChange={f('phone')} required /></div>
            <div><label className="form-label">Gender *</label>
              <select className="input-field" value={form.gender} onChange={f('gender')}>
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
            <div className="sm:col-span-2"><label className="form-label">Confirm Password *</label><input type="password" className="input-field" value={form.confirmPassword} onChange={f('confirmPassword')} required /></div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">{createMut.isPending ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit — ${editTarget?.name}`} size="sm">
        <form onSubmit={(e) => { e.preventDefault(); updateMut.mutate({ id: editTarget._id, data: editForm }); }} className="space-y-4">
          <div><label className="form-label">Name</label><input className="input-field" value={editForm.name} onChange={ef('name')} /></div>
          <div><label className="form-label">Phone</label><input className="input-field" maxLength={10} value={editForm.phone} onChange={ef('phone')} /></div>
          <div><label className="form-label">New Password (leave blank to keep current)</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className="input-field pr-10" placeholder="Enter new password or leave blank" value={editForm.newPassword} onChange={ef('newPassword')} />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={updateMut.isPending} className="btn-primary flex-1">{updateMut.isPending ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}