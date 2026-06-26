import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, UserCheck } from 'lucide-react';
import api from '../../api/axios';
import { apiError, getStatusColor } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const EMPTY = { name: '', email: '', phone: '', gender: 'male', dateOfBirth: '', rankId: '', badgeNumber: '', designation: '' };

export default function ManageOfficers() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | officer obj
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['op-officers', page, search, rankFilter],
    queryFn: () => api.get(`/operator/officers?page=${page}&limit=12&search=${search}&rankId=${rankFilter}`).then(r => r.data.data),
  });

  const { data: ranks = [] } = useQuery({
    queryKey: ['op-ranks'],
    queryFn: () => api.get('/operator/ranks/availability').then(r => r.data.data.ranks),
  });

  const createMut = useMutation({
    mutationFn: (d) => api.post('/operator/officers', d),
    onSuccess: () => { toast.success('Officer added!'); qc.invalidateQueries(['op-officers']); setModal(null); setForm(EMPTY); },
    onError: (err) => toast.error(apiError(err)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/operator/officers/${id}`, data),
    onSuccess: () => { toast.success('Officer updated'); qc.invalidateQueries(['op-officers']); setModal(null); },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/operator/officers/${id}`),
    onSuccess: () => { toast.success('Officer removed'); qc.invalidateQueries(['op-officers']); setDeleteTarget(null); },
    onError: (err) => toast.error(apiError(err)),
  });

  const openEdit = (off) => {
    setForm({ name: off.name, email: off.email, phone: off.phone, gender: off.gender || 'male',
      dateOfBirth: off.dateOfBirth ? off.dateOfBirth.split('T')[0] : '',
      rankId: off.rankRef?._id || '', badgeNumber: off.badgeNumber || '', designation: off.designation || '' });
    setModal(off);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.rankId) { toast.error('Select a rank'); return; }
    if (!/^[6-9]\d{9}$/.test(form.phone)) { toast.error('Invalid phone'); return; }
    if (modal === 'create') createMut.mutate(form);
    else updateMut.mutate({ id: modal._id, data: form });
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Officers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage officers in your area</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setModal('create'); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Officer
        </button>
      </div>

      {/* Rank availability banner */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Rank Availability</p>
        <div className="flex flex-wrap gap-2">
          {ranks.map(rank => (
            <div key={rank._id} className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: rank.color }}>
                {rank.code}
              </span>
              <span className={`text-xs font-medium ${rank.availableCount === 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                {rank.name}: {rank.availableCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by name or badge..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field sm:w-44" value={rankFilter} onChange={e => { setRankFilter(e.target.value); setPage(1); }}>
          <option value="">All Ranks</option>
          {ranks.map(r => <option key={r._id} value={r._id}>{r.name} ({r.availableCount})</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="card py-12 flex justify-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : data?.data?.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No officers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.data.map(officer => (
            <div key={officer._id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: officer.rankRef?.color || '#6b7280' }}>
                    {officer.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{officer.name}</p>
                    {officer.badgeNumber && <p className="text-xs text-gray-400">#{officer.badgeNumber}</p>}
                  </div>
                </div>
                <span className={`badge ${getStatusColor(officer.status)} shrink-0`}>{officer.status}</span>
              </div>

              {officer.rankRef && (
                <span className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: officer.rankRef.color }}>
                  {officer.rankRef.code} — {officer.rankRef.name}
                </span>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                <p>{officer.phone}</p>
                {officer.designation && <p>{officer.designation}</p>}
              </div>

              <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => openEdit(officer)} className="btn-secondary flex-1 text-xs py-1.5">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => setDeleteTarget(officer)} className="btn-danger flex-1 text-xs py-1.5">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {data?.pagination && <Pagination pagination={data.pagination} onPageChange={setPage} />}

      {/* Create/Edit Modal */}
      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Add Officer' : `Edit — ${modal?.name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Full Name *</label><input className="input-field" value={form.name} onChange={f('name')} required /></div>
            <div><label className="form-label">Email *</label><input type="email" className="input-field" value={form.email} onChange={f('email')} required disabled={modal !== 'create'} /></div>
            <div><label className="form-label">Phone *</label><input className="input-field" maxLength={10} value={form.phone} onChange={f('phone')} required /></div>
            <div><label className="form-label">Gender *</label>
              <select className="input-field" value={form.gender} onChange={f('gender')}>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
            <div><label className="form-label">Date of Birth</label><input type="date" className="input-field" value={form.dateOfBirth} onChange={f('dateOfBirth')} /></div>
            <div><label className="form-label">Rank *</label>
              <select className="input-field" value={form.rankId} onChange={f('rankId')} required>
                <option value="">Select rank</option>
                {ranks.map(r => (
                  <option key={r._id} value={r._id} >
                    {r.code} — {r.name} 
                  </option>
                ))}
              </select>
            </div>
            <div><label className="form-label">Badge Number</label><input className="input-field" placeholder="P001" value={form.badgeNumber} onChange={f('badgeNumber')} /></div>
            <div><label className="form-label">Designation</label><input className="input-field" placeholder="Head Constable" value={form.designation} onChange={f('designation')} /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : modal === 'create' ? 'Add Officer' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMut.mutate(deleteTarget._id)}
        loading={deleteMut.isPending}
        title="Remove Officer"
        message={`Remove ${deleteTarget?.name}? They must not have active duties.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
