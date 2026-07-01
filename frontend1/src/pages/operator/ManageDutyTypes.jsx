import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, Pencil, Trash2, Layers, Lock } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { apiError } from '../../utils/helpers';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const emptyForm = () => ({ name: '', description: '', rankRequirements: [{ rankRef: '', count: 1 }] });

export default function ManageDutyTypes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isRegular = user?.role === 'operator_regular';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: ranks = [] } = useQuery({
    queryKey: ['op-ranks'],
    queryFn: () => api.get('/operator/ranks/availability').then(r => r.data.data.ranks),
    enabled: isRegular,
  });

  const { data: dutyTypes = [], isLoading } = useQuery({
    queryKey: ['op-duty-types'],
    queryFn: () => api.get('/operator/duty-types').then(r => r.data.data.dutyTypes),
    enabled: isRegular,
  });

  const saveMut = useMutation({
    mutationFn: (payload) => editingId
      ? api.put(`/operator/duty-types/${editingId}`, payload)
      : api.post('/operator/duty-types', payload),
    onSuccess: () => {
      toast.success(editingId ? 'ड्यूटी प्रकार अपडेट हुआ' : 'ड्यूटी प्रकार सहेजा गया');
      qc.invalidateQueries(['op-duty-types']);
      closeModal();
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/operator/duty-types/${id}`),
    onSuccess: () => {
      toast.success('ड्यूटी प्रकार हटाया गया');
      qc.invalidateQueries(['op-duty-types']);
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (dt) => {
    setEditingId(dt._id);
    setForm({
      name: dt.name,
      description: dt.description || '',
      rankRequirements: dt.rankRequirements.map(r => ({ rankRef: r.rankRef?._id || r.rankRef, count: r.count })),
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm()); };

  const addRankRow = () => setForm(f => ({ ...f, rankRequirements: [...f.rankRequirements, { rankRef: '', count: 1 }] }));
  const removeRankRow = (i) => setForm(f => ({ ...f, rankRequirements: f.rankRequirements.filter((_, idx) => idx !== i) }));
  const setRankRow = (i, key, val) => setForm(f => ({
    ...f,
    rankRequirements: f.rankRequirements.map((r, idx) => idx === i ? { ...r, [key]: val } : r),
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('नाम आवश्यक है'); return; }
    const valid = form.rankRequirements.filter(r => r.rankRef && r.count > 0);
    if (valid.length === 0) { toast.error('कम से कम एक रैंक जोड़ें'); return; }
    saveMut.mutate({ name: form.name, description: form.description, rankRequirements: valid });
  };

  if (!isRegular) {
    return (
      <div className="max-w-lg mx-auto card p-8 text-center space-y-3">
        <Lock className="w-8 h-8 mx-auto text-ink-300" />
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">केवल सामान्य ऑपरेटर के लिए</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          ड्यूटी प्रकार बनाना और प्रबंधित करना केवल सामान्य ऑपरेटर (Regular Operator) के लिए उपलब्ध है।
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">ड्यूटी प्रकार</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            अपने सामान्य ड्यूटी टेम्पलेट यहां बनाएं — रैंक और संख्या पहले से तय करें, ताकि ड्यूटी बनाते समय बार-बार टाइप न करना पड़े।
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" /> नया ड्यूटी प्रकार
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-ink-400">लोड हो रहा है...</div>
      ) : dutyTypes.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <Layers className="w-8 h-8 mx-auto text-ink-300" />
          <p className="text-sm text-ink-500 dark:text-ink-400">अभी तक कोई ड्यूटी प्रकार नहीं बनाया गया।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {dutyTypes.map(dt => (
            <div key={dt._id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{dt.name}</h3>
                  {dt.description && <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{dt.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(dt)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-ink-500">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(dt)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dt.rankRequirements.map((r, i) => (
                  <span key={i} className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                    {r.rankRef?.code || r.rankRef?.name} × {r.count}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? 'ड्यूटी प्रकार संपादित करें' : 'नया ड्यूटी प्रकार'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">नाम *</label>
            <input className="input-field" placeholder="जैसे: सामान्य गश्त" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="form-label">विवरण (वैकल्पिक)</label>
            <input className="input-field" placeholder="संक्षिप्त विवरण" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label !mb-0">रैंक व संख्या *</label>
              <button type="button" onClick={addRankRow} className="btn-secondary text-xs py-1 px-2">
                <Plus className="w-3 h-3" /> जोड़ें
              </button>
            </div>
            <div className="space-y-2">
              {form.rankRequirements.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select className="input-field text-sm flex-1" value={r.rankRef}
                    onChange={e => setRankRow(i, 'rankRef', e.target.value)} required>
                    <option value="">रैंक चुनें</option>
                    {ranks.map(rk => <option key={rk._id} value={rk._id}>{rk.code} — {rk.name}</option>)}
                  </select>
                  <input type="number" min={1} className="input-field text-sm w-20"
                    value={r.count} onChange={e => setRankRow(i, 'count', parseInt(e.target.value) || 1)} required />
                  {form.rankRequirements.length > 1 && (
                    <button type="button" onClick={() => removeRankRow(i)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 shrink-0">
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">रद्द करें</button>
            <button type="submit" disabled={saveMut.isPending} className="btn-primary flex-1">
              {saveMut.isPending ? 'सहेजा जा रहा है...' : 'सहेजें'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMut.mutate(deleteTarget._id)}
        title="ड्यूटी प्रकार हटाएं?"
        message={`क्या आप वाकई "${deleteTarget?.name}" हटाना चाहते हैं? पहले से बनी ड्यूटी इससे प्रभावित नहीं होंगी।`}
        confirmLabel="हटाएं"
        danger
        loading={deleteMut.isPending}
      />
    </div>
  );
}