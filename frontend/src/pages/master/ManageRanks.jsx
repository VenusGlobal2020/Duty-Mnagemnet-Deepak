import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import api from '../../api/axios';
import { apiError } from '../../utils/helpers';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

const EMPTY = { name: '', code: '', priority: '', color: '#3B82F6' };

export default function ManageRanks() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'create' | rank object for edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data: ranks = [], isLoading } = useQuery({
    queryKey: ['master-ranks'],
    queryFn: () => api.get('/master/ranks').then(r => r.data.data.ranks),
  });

  const createMut = useMutation({
    mutationFn: (d) => api.post('/master/ranks', d),
    onSuccess: () => { toast.success('Rank created'); qc.invalidateQueries(['master-ranks']); setModal(null); setForm(EMPTY); },
    onError: (err) => toast.error(apiError(err)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/master/ranks/${id}`, data),
    onSuccess: () => { toast.success('Rank updated'); qc.invalidateQueries(['master-ranks']); setModal(null); },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/master/ranks/${id}`),
    onSuccess: () => { toast.success('Rank removed'); qc.invalidateQueries(['master-ranks']); setDeleteTarget(null); },
    onError: (err) => toast.error(apiError(err)),
  });

  const openEdit = (rank) => {
    setForm({ name: rank.name, code: rank.code, priority: rank.priority, color: rank.color });
    setModal(rank);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.code || !form.priority) { toast.error('All fields required'); return; }
    const payload = { ...form, priority: parseInt(form.priority) };
    if (modal === 'create') createMut.mutate(payload);
    else updateMut.mutate({ id: modal._id, data: payload });
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Manage Ranks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Define dynamic ranks and priorities</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setModal('create'); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Rank
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
        ) : ranks.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Star className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No ranks defined yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {ranks.sort((a, b) => a.priority - b.priority).map((rank, i) => (
              <div key={rank._id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-4">{i + 1}</span>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
                    style={{ backgroundColor: rank.color }}
                  >
                    {rank.code}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{rank.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Code: {rank.code} · Priority: {rank.priority}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(rank)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(rank)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Color legend */}
      {ranks.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Rank Color Preview</p>
          <div className="flex flex-wrap gap-2">
            {ranks.map(rank => (
              <span
                key={rank._id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold"
                style={{ backgroundColor: rank.color }}
              >
                {rank.code} — {rank.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add New Rank' : `Edit Rank — ${modal?.name}`}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Rank Name *</label>
            <input className="input-field" placeholder="e.g. Superintendent of Police" value={form.name} onChange={f('name')} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Code *</label>
              <input className="input-field uppercase" placeholder="e.g. A" maxLength={5} value={form.code} onChange={f('code')} required />
            </div>
            <div>
              <label className="form-label">Priority * (1=highest)</label>
              <input type="number" min={1} className="input-field" placeholder="1" value={form.priority} onChange={f('priority')} required />
            </div>
          </div>
          <div>
            <label className="form-label">Badge Color</label>
            <div className="flex items-center gap-3">
              <input type="color" className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer" value={form.color} onChange={f('color')} />
              <span className="text-sm text-gray-500">{form.color}</span>
              <span className="px-3 py-1 rounded-full text-white text-xs font-bold" style={{ backgroundColor: form.color }}>
                {form.code || 'CODE'} — {form.name || 'Name'}
              </span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1">
              {(createMut.isPending || updateMut.isPending) ? 'Saving...' : modal === 'create' ? 'Create Rank' : 'Update Rank'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMut.mutate(deleteTarget._id)}
        loading={deleteMut.isPending}
        title="Remove Rank"
        message={`Are you sure you want to remove the rank "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
