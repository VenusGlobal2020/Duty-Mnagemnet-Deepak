import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, MapPin, Upload, X, AlertTriangle, UserCheck } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { apiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function CreateDuty() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isSpecial = user?.role === 'operator_special';

  const [form, setForm] = useState({
    dutyName: '', locationName: '', lat: '', lng: '',
    startDate: '', endDate: '', priority: '3',
    dutyType: isSpecial ? 'CITY-POINT' : '',
    description: '',
  });
  const [phoneNumbers, setPhoneNumbers] = useState(['']);
  // manualOfficerIds: selected officer _ids for this row when assignmentType === 'manual'
  const [rankRequirements, setRankRequirements] = useState([{ rankRef: '', count: 1, assignmentType: 'auto', manualOfficerIds: [] }]);
  const [files, setFiles] = useState([]);
  const [rankWarning, setRankWarning] = useState([]);
  const [manualWarning, setManualWarning] = useState([]);

  const { data: ranks = [] } = useQuery({
    queryKey: ['op-ranks'],
    queryFn: () => api.get('/operator/ranks/availability').then(r => r.data.data.ranks),
  });

  const createMut = useMutation({
    mutationFn: (fd) => api.post('/operator/duties', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (res) => {
      const warn = res.data.data?.rankNotAvailable;
      const manualWarn = res.data.data?.manualUnavailable;
      if (warn?.length > 0 || manualWarn?.length > 0) {
        setRankWarning(warn || []);
        setManualWarning(manualWarn || []);
        toast.success('Duty created with partial assignment. Some officers unavailable.');
      } else {
        toast.success('Duty created and officers assigned!');
        navigate('/operator/duties');
      }
      qc.invalidateQueries(['op-duties-recent']);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.dutyName || !form.locationName || !form.lat || !form.lng || !form.startDate || !form.endDate) {
      toast.error('Fill all required fields'); return;
    }
    if (new Date(form.startDate) >= new Date(form.endDate)) {
      toast.error('End date must be after start date'); return;
    }
    if (new Date(form.startDate) <= new Date()) {
      toast.error('Start time must be in the future'); return;
    }
    const validRanks = rankRequirements.filter(r => r.rankRef);
    if (validRanks.length === 0) { toast.error('Add at least one rank requirement'); return; }

    // For manual rows, make sure the operator has actually picked officers
    for (const r of validRanks) {
      if (r.assignmentType === 'manual' && (r.manualOfficerIds || []).length === 0) {
        toast.error('Select officers for manual assignment, or switch to Auto'); return;
      }
    }

    const manualAssignments = validRanks
      .filter(r => r.assignmentType === 'manual')
      .flatMap(r => r.manualOfficerIds.map(officerId => ({ officerId, rankRef: r.rankRef })));

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    fd.append('phoneNumbers', JSON.stringify(phoneNumbers.filter(Boolean)));
    fd.append('rankRequirements', JSON.stringify(validRanks.map(({ manualOfficerIds, ...rest }) => rest)));
    if (manualAssignments.length > 0) {
      fd.append('manualAssignments', JSON.stringify(manualAssignments));
    }
    files.forEach(f => fd.append('documents', f));
    createMut.mutate(fd);
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const addPhone = () => setPhoneNumbers(p => [...p, '']);
  const removePhone = (i) => setPhoneNumbers(p => p.filter((_, idx) => idx !== i));
  const setPhone = (i, v) => setPhoneNumbers(p => p.map((x, idx) => idx === i ? v : x));

  const addRank = () => setRankRequirements(p => [...p, { rankRef: '', count: 1, assignmentType: 'auto', manualOfficerIds: [] }]);
  const removeRank = (i) => setRankRequirements(p => p.filter((_, idx) => idx !== i));
  const setRank = (i, k, v) => setRankRequirements(p => p.map((x, idx) => {
    if (idx !== i) return x;
    const next = { ...x, [k]: v };
    // Reset officer picks whenever rank or assignment type changes, so stale
    // selections from a different rank can't leak through.
    if (k === 'rankRef' || k === 'assignmentType') next.manualOfficerIds = [];
    return next;
  }));

  const toggleManualOfficer = (i, officerId, maxCount) => {
    setRankRequirements(p => p.map((x, idx) => {
      if (idx !== i) return x;
      const current = x.manualOfficerIds || [];
      if (current.includes(officerId)) {
        return { ...x, manualOfficerIds: current.filter(id => id !== officerId) };
      }
      if (current.length >= maxCount) {
        toast.error(`You can only select ${maxCount} officer(s) for this rank requirement`);
        return x;
      }
      return { ...x, manualOfficerIds: [...current, officerId] };
    }));
  };

  const getRankAvail = (rankId) => ranks.find(r => r._id === rankId)?.availableCount ?? 0;

  if (rankWarning.length > 0 || manualWarning.length > 0) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 text-orange-600">
            <AlertTriangle className="w-8 h-8" />
            <h2 className="text-lg font-bold">Duty Created — Partial Assignment</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">The duty was created but some officers could not be assigned:</p>
          {rankWarning.map((w, i) => (
            <div key={`r-${i}`} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm">
              <span className="font-medium text-orange-700 dark:text-orange-300">{w.rankName}</span>
              <span className="text-orange-600 dark:text-orange-400"> — Required: {w.required}, Available: {w.available}</span>
            </div>
          ))}
          {manualWarning.map((w, i) => (
            <div key={`m-${i}`} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm">
              <span className="font-medium text-orange-700 dark:text-orange-300">{w.name || 'Selected officer'}</span>
              <span className="text-orange-600 dark:text-orange-400"> — {w.reason}</span>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={() => navigate('/operator/duties')} className="btn-primary flex-1">Go to Duties</button>
            <button onClick={() => { setRankWarning([]); setManualWarning([]); navigate('/operator/officers'); }} className="btn-secondary flex-1">Manage Officers</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create New Duty</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {isSpecial ? 'Special Operator — all duty types available' : 'Regular Operator — standard duties'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="form-label">Duty Name *</label><input className="input-field" placeholder="e.g. VIP Security Detail" value={form.dutyName} onChange={f('dutyName')} required /></div>
            <div className="sm:col-span-2"><label className="form-label">Location Name *</label><input className="input-field" placeholder="e.g. Prayagraj Collectorate" value={form.locationName} onChange={f('locationName')} required /></div>
            <div>
              <label className="form-label">Latitude *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input-field pl-9" type="number" step="any" placeholder="25.4358" value={form.lat} onChange={f('lat')} required />
              </div>
            </div>
            <div>
              <label className="form-label">Longitude *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input-field pl-9" type="number" step="any" placeholder="81.8463" value={form.lng} onChange={f('lng')} required />
              </div>
            </div>
            <div><label className="form-label">Start Date & Time *</label><input type="datetime-local" className="input-field" value={form.startDate} onChange={f('startDate')} required /></div>
            <div><label className="form-label">End Date & Time *</label><input type="datetime-local" className="input-field" value={form.endDate} onChange={f('endDate')} required /></div>
            <div>
              <label className="form-label">Priority * (1=Critical, 5=Minimal)</label>
              <select className="input-field" value={form.priority} onChange={f('priority')} required>
                <option value="1">1 — Critical</option><option value="2">2 — High</option>
                <option value="3">3 — Medium</option><option value="4">4 — Low</option><option value="5">5 — Minimal</option>
              </select>
            </div>
            {isSpecial && (
              <div>
                <label className="form-label">Duty Type *</label>
                <select className="input-field" value={form.dutyType} onChange={f('dutyType')} required>
                  <option value="VVIP">VVIP</option>
                  <option value="CITY-POINT">CITY-POINT</option>
                  <option value="CRIMINAL">CRIMINAL</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2"><label className="form-label">Description (optional)</label><textarea className="input-field" rows={3} placeholder="Additional details..." value={form.description} onChange={f('description')} /></div>
          </div>
        </div>

        {/* Rank Requirements */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Rank Requirements</h2>
            <button type="button" onClick={addRank} className="btn-secondary text-sm py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Add Rank
            </button>
          </div>
          {rankRequirements.map((req, i) => {
            const avail = req.rankRef ? getRankAvail(req.rankRef) : null;
            return (
              <div key={i} className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                <div className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-5">
                    <label className="form-label text-xs">Rank *</label>
                    <select className="input-field text-sm" value={req.rankRef} onChange={e => setRank(i, 'rankRef', e.target.value)} required>
                      <option value="">Select rank</option>
                      {ranks.map(r => (
                        <option key={r._id} value={r._id}>
                          {r.code} — {r.name} ({r.availableCount})
                        </option>
                      ))}
                    </select>
                    {avail !== null && (
                      <p className={`text-xs mt-0.5 ${avail === 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {avail === 0 ? '⚠ No officers available' : `${avail} available`}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="form-label text-xs">Count *</label>
                    <input type="number" min={1} max={avail || 99} className="input-field text-sm" value={req.count} onChange={e => setRank(i, 'count', parseInt(e.target.value))} required />
                  </div>
                  <div className="col-span-4">
                    <label className="form-label text-xs">Assignment</label>
                    <select className="input-field text-sm" value={req.assignmentType} onChange={e => setRank(i, 'assignmentType', e.target.value)}>
                      <option value="auto">Auto (Random)</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div className="col-span-1 pt-6">
                    {rankRequirements.length > 1 && (
                      <button type="button" onClick={() => removeRank(i)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Manual officer picker — only shown when this row is set to Manual */}
                {req.assignmentType === 'manual' && req.rankRef && (
                  <ManualOfficerPicker
                    rankId={req.rankRef}
                    count={req.count || 1}
                    selectedIds={req.manualOfficerIds || []}
                    onToggle={(officerId) => toggleManualOfficer(i, officerId, req.count || 1)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Phone Numbers */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Contact Numbers</h2>
            <button type="button" onClick={addPhone} className="btn-secondary text-sm py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          {phoneNumbers.map((ph, i) => (
            <div key={i} className="flex gap-2">
              <input className="input-field flex-1 text-sm" maxLength={10} placeholder="98XXXXXXXX" value={ph} onChange={e => setPhone(i, e.target.value)} />
              {phoneNumbers.length > 1 && (
                <button type="button" onClick={() => removePhone(i)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Documents */}
        <div className="card p-5 space-y-3">
          <h2 className="section-title">Supporting Documents (optional)</h2>
          <div
            onClick={() => document.getElementById('doc-input').click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <input id="doc-input" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
              onChange={e => setFiles(Array.from(e.target.files))} />
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Click to upload PDFs, images, or Word docs (max 5)</p>
          </div>
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <span className="truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                  <button type="button" onClick={() => setFiles(fs => fs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 ml-2">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/operator/duties')} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1 py-2.5">
            {createMut.isPending ? 'Creating...' : 'Create Duty & Assign Officers'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Fetches and lists officers of the selected rank who are actually free right
// now (not already on another active duty), so the operator can hand-pick
// exactly who goes on this duty instead of relying on random auto-assignment.
function ManualOfficerPicker({ rankId, count, selectedIds, onToggle }) {
  const { data: officers = [], isLoading } = useQuery({
    queryKey: ['op-available-officers', rankId],
    queryFn: () => api.get(`/operator/officers/available?rankId=${rankId}`).then(r => r.data.data.officers),
    enabled: !!rankId,
  });

  return (
    <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" /> Select officer(s) — {selectedIds.length}/{count} chosen
        </p>
      </div>
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading officers...</p>
      ) : officers.length === 0 ? (
        <p className="text-xs text-red-500">No available officers of this rank right now</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
          {officers.map(o => {
            const checked = selectedIds.includes(o._id);
            return (
              <label key={o._id} className={`flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg cursor-pointer border transition-colors ${checked ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}>
                <input type="checkbox" className="accent-primary-600" checked={checked} onChange={() => onToggle(o._id)} />
                <span className="truncate text-gray-800 dark:text-gray-200">{o.name}</span>
                {o.badgeNumber && <span className="text-xs text-gray-400 ml-auto shrink-0">#{o.badgeNumber}</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}