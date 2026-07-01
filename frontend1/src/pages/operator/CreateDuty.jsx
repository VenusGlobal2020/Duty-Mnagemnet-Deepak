import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, MapPin, Upload, X, AlertTriangle, UserCheck, Search, Map as MapIcon, Car, Phone, Clock, Layers } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { apiError } from '../../utils/helpers';
import LocationPickerMap from '../../components/common/LocationPickerMap';
import toast from 'react-hot-toast';

const OTHER = '__other__';

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
    vehicleNumber: '',
  });
  const [phoneNumbers, setPhoneNumbers] = useState(['']);
  const [rankRequirements, setRankRequirements] = useState([
    { rankRef: '', count: 1, assignmentType: 'auto', manualOfficerIds: [] }
  ]);
  const [files, setFiles] = useState([]);
  const [rankWarning, setRankWarning] = useState([]);
  const [manualWarning, setManualWarning] = useState([]);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  // ── Duty type template (regular operator only) ──
  const [selectedDutyType, setSelectedDutyType] = useState(OTHER);

  const { data: dutyTypes = [] } = useQuery({
    queryKey: ['op-duty-types'],
    queryFn: () => api.get('/operator/duty-types').then(r => r.data.data.dutyTypes),
    enabled: !isSpecial,
  });

  // ── Dynamic shifts — only relevant when the duty spans more than one day ──
  const [shifts, setShifts] = useState([]);
  const isMultiDay = (() => {
    if (!form.startDate || !form.endDate) return false;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    return (end - start) > 24 * 60 * 60 * 1000;
  })();

  const addShift = () => setShifts(s => [...s, { label: '', startTime: '09:00', endTime: '17:00' }]);
  const removeShift = (i) => setShifts(s => s.filter((_, idx) => idx !== i));
  const setShift = (i, key, val) => setShifts(s => s.map((sh, idx) => idx === i ? { ...sh, [key]: val } : sh));

  const handleDutyTypeChange = (dutyTypeId) => {
    setSelectedDutyType(dutyTypeId);
    if (dutyTypeId === OTHER) {
      setRankRequirements([{ rankRef: '', count: 1, assignmentType: 'auto', manualOfficerIds: [] }]);
      return;
    }
    const template = dutyTypes.find(dt => dt._id === dutyTypeId);
    if (template) {
      setRankRequirements(template.rankRequirements.map(r => ({
        rankRef: r.rankRef?._id || r.rankRef, count: r.count, assignmentType: 'auto', manualOfficerIds: [],
      })));
    }
  };

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

    for (const r of validRanks) {
      if (r.assignmentType === 'manual') {
        const selected = (r.manualOfficerIds || []).length;
        const required = Number(r.count) || 1;
        if (selected === 0) {
          toast.error('Select officers for manual assignment, or switch to Auto'); return;
        }
        if (selected !== required) {
          const rankName = ranks.find(rk => rk._id === r.rankRef)?.name || 'selected rank';
          toast.error(
            `Manual assignment error (${rankName}): ${selected} officer(s) selected but ${required} required. ` +
            `Please adjust your selection or the count.`
          );
          return;
        }
      }
    }

    // Validate vehicle number format (optional but if provided must be valid)
    if (form.vehicleNumber && !/^[A-Z0-9 \-]{2,15}$/i.test(form.vehicleNumber)) {
      toast.error('Vehicle number format is invalid'); return;
    }

    if (isMultiDay) {
      for (const s of shifts) {
        if (!s.label || !s.startTime || !s.endTime) {
          toast.error('Fill in label, start time, and end time for every shift, or remove empty rows'); return;
        }
      }
    }

    const manualAssignments = validRanks
      .filter(r => r.assignmentType === 'manual')
      .flatMap(r => r.manualOfficerIds.map(officerId => ({ officerId, rankRef: r.rankRef })));

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    fd.append('phoneNumbers', JSON.stringify(phoneNumbers.filter(Boolean)));
    // "Other" means manual rank entry, exactly like before. A selected
    // template just tells the backend which DutyType to snapshot from.
    if (!isSpecial && selectedDutyType !== OTHER) {
      fd.append('dutyTypeRef', selectedDutyType);
    } else {
      fd.append('rankRequirements', JSON.stringify(validRanks.map(({ manualOfficerIds, ...rest }) => rest)));
    }
    if (isMultiDay && shifts.length > 0) {
      fd.append('shifts', JSON.stringify(shifts));
    }
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

  const addRank = () => setRankRequirements(p => [
    ...p, { rankRef: '', count: 1, assignmentType: 'auto', manualOfficerIds: [] }
  ]);
  const removeRank = (i) => setRankRequirements(p => p.filter((_, idx) => idx !== i));
  const setRank = (i, k, v) => setRankRequirements(p => p.map((x, idx) => {
    if (idx !== i) return x;
    const next = { ...x, [k]: v };
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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The duty was created but some officers could not be assigned:
          </p>
          {rankWarning.map((w, i) => (
            <div key={`r-${i}`} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm">
              <span className="font-medium text-orange-700 dark:text-orange-300">{w.rankName}</span>
              <span className="text-orange-600 dark:text-orange-400">
                {' '}— Required: {w.required}, Available: {w.available}
              </span>
            </div>
          ))}
          {manualWarning.map((w, i) => (
            <div key={`m-${i}`} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm">
              <span className="font-medium text-orange-700 dark:text-orange-300">
                {w.name || 'Selected officer'}
              </span>
              <span className="text-orange-600 dark:text-orange-400"> — {w.reason}</span>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={() => navigate('/operator/duties')} className="btn-primary flex-1">
              Go to Duties
            </button>
            <button
              onClick={() => { setRankWarning([]); setManualWarning([]); navigate('/operator/officers'); }}
              className="btn-secondary flex-1"
            >
              Manage Officers
            </button>
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
            <div className="sm:col-span-2">
              <label className="form-label">Duty Name *</label>
              <input className="input-field" placeholder="e.g. VIP Security Detail"
                value={form.dutyName} onChange={f('dutyName')} required />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Location Name *</label>
              <input className="input-field" placeholder="e.g. Prayagraj Collectorate"
                value={form.locationName} onChange={f('locationName')} required />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between -mb-1">
              <label className="form-label !mb-0">Location Coordinates *</label>
              <button
                type="button"
                onClick={() => setMapPickerOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-signal2-600 dark:text-signal2-400 hover:underline"
              >
                <MapIcon className="w-3.5 h-3.5" /> Fetch from Map
              </button>
            </div>
            <div>
              <label className="form-label">Latitude *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input-field pl-9" type="number" step="any" placeholder="25.4358"
                  value={form.lat} onChange={f('lat')} required />
              </div>
            </div>
            <div>
              <label className="form-label">Longitude *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input-field pl-9" type="number" step="any" placeholder="81.8463"
                  value={form.lng} onChange={f('lng')} required />
              </div>
            </div>
            <div>
              <label className="form-label">Start Date & Time *</label>
              <input type="datetime-local" className="input-field"
                value={form.startDate} onChange={f('startDate')} required />
            </div>
            <div>
              <label className="form-label">End Date & Time *</label>
              <input type="datetime-local" className="input-field"
                value={form.endDate} onChange={f('endDate')} required />
            </div>
            <div>
              <label className="form-label">Priority * (1=Critical, 5=Minimal)</label>
              <select className="input-field" value={form.priority} onChange={f('priority')} required>
                <option value="1">1 — Critical</option>
                <option value="2">2 — High</option>
                <option value="3">3 — Medium</option>
                <option value="4">4 — Low</option>
                <option value="5">5 — Minimal</option>
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

            {/* Vehicle Number — optional */}
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-ink-400" /> Vehicle Number
                <span className="text-xs font-normal text-ink-400">(optional)</span>
              </label>
              <input
                className="input-field uppercase tracking-widest"
                placeholder="e.g. UP70AB1234"
                maxLength={15}
                value={form.vehicleNumber}
                onChange={e => setForm(p => ({ ...p, vehicleNumber: e.target.value.toUpperCase() }))}
              />
              <p className="text-xs text-ink-400 mt-1">Vehicle assigned to this duty, if any.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Description (optional)</label>
              <textarea className="input-field" rows={3} placeholder="Additional details..."
                value={form.description} onChange={f('description')} />
            </div>
          </div>
        </div>

        {/* Shifts — only for multi-day duties */}
        {isMultiDay && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary-600" /> Shifts (multi-day duty)
                </h2>
                <p className="text-xs text-ink-400 mt-0.5">
                  This duty spans more than one day. Define the shift(s) officers will check in/out against — fully your call, e.g. "9 to 5", "5 to 10".
                </p>
              </div>
              <button type="button" onClick={addShift} className="btn-secondary text-sm py-1.5 px-3 shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add Shift
              </button>
            </div>
            {shifts.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No shifts defined yet — officers will check in without a specific shift tag. Add one or more shifts above if you want daily attendance split by shift.
              </p>
            )}
            {shifts.map((s, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <label className="form-label text-xs">Label</label>
                  <input className="input-field text-sm" placeholder="e.g. Morning Shift"
                    value={s.label} onChange={e => setShift(i, 'label', e.target.value)} />
                </div>
                <div className="col-span-3">
                  <label className="form-label text-xs">Start</label>
                  <input type="time" className="input-field text-sm" value={s.startTime}
                    onChange={e => setShift(i, 'startTime', e.target.value)} />
                </div>
                <div className="col-span-3">
                  <label className="form-label text-xs">End</label>
                  <input type="time" className="input-field text-sm" value={s.endTime}
                    onChange={e => setShift(i, 'endTime', e.target.value)} />
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeShift(i)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rank Requirements */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Resources Requirements</h2>
            <button type="button" onClick={addRank} className="btn-secondary text-sm py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Add Resource
            </button>
          </div>

          {!isSpecial && (
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-ink-400" /> Duty Type Template
              </label>
              <select className="input-field" value={selectedDutyType} onChange={e => handleDutyTypeChange(e.target.value)}>
                <option value={OTHER}>Other (enter ranks manually)</option>
                {dutyTypes.map(dt => (
                  <option key={dt._id} value={dt._id}>{dt.name}</option>
                ))}
              </select>
              <p className="text-xs text-ink-400 mt-1">
                Pick a saved duty type to auto-fill ranks below, or choose "Other" to enter them manually as usual. You can still adjust counts either way.{' '}
                <a href="/operator/duty-types" className="text-signal2-600 dark:text-signal2-400 hover:underline">Manage duty types</a>
              </p>
            </div>
          )}

          {rankRequirements.map((req, i) => {
            const avail = req.rankRef ? getRankAvail(req.rankRef) : null;
            const selectedCount = (req.manualOfficerIds || []).length;
            const requiredCount = Number(req.count) || 1;
            const hasCountMismatch = req.assignmentType === 'manual' && selectedCount > 0 && selectedCount !== requiredCount;

            return (
              <div key={i} className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                <div className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-5">
                    <label className="form-label text-xs">Rank *</label>
                    <select className="input-field text-sm" value={req.rankRef}
                      onChange={e => setRank(i, 'rankRef', e.target.value)} required>
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
                    <input type="number" min={1} max={avail || 99} className="input-field text-sm"
                      value={req.count} onChange={e => setRank(i, 'count', parseInt(e.target.value))} required />
                  </div>
                  <div className="col-span-4">
                    <label className="form-label text-xs">Assignment</label>
                    <select className="input-field text-sm" value={req.assignmentType}
                      onChange={e => setRank(i, 'assignmentType', e.target.value)}>
                      <option value="auto">Auto (Random)</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div className="col-span-1 pt-6">
                    {rankRequirements.length > 1 && (
                      <button type="button" onClick={() => removeRank(i)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {hasCountMismatch && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      <strong>{selectedCount}</strong> officer(s) selected but count is set to{' '}
                      <strong>{requiredCount}</strong>.{' '}
                      {selectedCount > requiredCount
                        ? `Please deselect ${selectedCount - requiredCount} officer(s) or increase the count.`
                        : `Please select ${requiredCount - selectedCount} more officer(s) or decrease the count.`}
                    </span>
                  </div>
                )}

                {req.assignmentType === 'manual' && req.rankRef && (
                  <ManualOfficerPicker
                    rankId={req.rankRef}
                    count={requiredCount}
                    selectedIds={req.manualOfficerIds || []}
                    onToggle={(officerId) => toggleManualOfficer(i, officerId, requiredCount)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Phone Numbers — with info note */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Duty Info Numbers</h2>
              <p className="text-xs text-ink-400 mt-0.5 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                These numbers will receive duty information via WhatsApp when the duty is created, updated, or cancelled.
              </p>
            </div>
            <button type="button" onClick={addPhone} className="btn-secondary text-sm py-1.5 px-3 shrink-0">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          {phoneNumbers.map((ph, i) => (
            <div key={i} className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
                <input
                  className="input-field pl-9 text-sm"
                  maxLength={13}
                  placeholder="e.g. 9876543210"
                  value={ph}
                  onChange={e => setPhone(i, e.target.value)}
                />
              </div>
              {phoneNumbers.length > 1 && (
                <button type="button" onClick={() => removePhone(i)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
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
            <input id="doc-input" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="hidden" onChange={e => setFiles(Array.from(e.target.files))} />
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Click to upload PDFs, images, or Word docs (max 5)</p>
          </div>
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <span className="truncate text-gray-700 dark:text-gray-300">{file.name}</span>
                  <button type="button"
                    onClick={() => setFiles(fs => fs.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 ml-2">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/operator/duties')} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1 py-2.5">
            {createMut.isPending ? 'Creating...' : 'Create Duty & Assign Officers'}
          </button>
        </div>
      </form>

      <LocationPickerMap
        isOpen={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        initialLat={form.lat ? parseFloat(form.lat) : undefined}
        initialLng={form.lng ? parseFloat(form.lng) : undefined}
        onConfirm={({ lat, lng }) => {
          setForm(p => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
          toast.success('Location picked from map!');
        }}
      />
    </div>
  );
}

// ─── Manual Officer Picker ────────────────────────────────────────────────────
function ManualOfficerPicker({ rankId, count, selectedIds, onToggle }) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput('');
    setDebouncedSearch('');
  }, [rankId]);

  const { data: officers = [], isLoading } = useQuery({
    queryKey: ['op-available-officers', rankId, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ rankId });
      if (debouncedSearch) params.set('search', debouncedSearch);
      return api.get(`/operator/officers/available?${params}`).then(r => r.data.data.officers);
    },
    enabled: !!rankId,
    keepPreviousData: true,
  });

  const isOverLimit = selectedIds.length > count;
  const isUnderLimit = selectedIds.length < count && selectedIds.length > 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium flex items-center gap-1.5 ${
          isOverLimit ? 'text-red-600 dark:text-red-400'
          : isUnderLimit ? 'text-orange-500'
          : selectedIds.length === count && count > 0 ? 'text-green-600 dark:text-green-400'
          : 'text-gray-600 dark:text-gray-300'
        }`}>
          <UserCheck className="w-3.5 h-3.5 shrink-0" />
          Select {count} officer(s) &mdash;{' '}
          <span className="font-bold">{selectedIds.length}/{count}</span> chosen
          {selectedIds.length === count && count > 0 && ' ✓'}
        </p>
        {selectedIds.length > 0 && (
          <span className="text-xs text-gray-400">{selectedIds.length} selected</span>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or badge number..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg
                     bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                     focus:outline-none focus:ring-1 focus:ring-primary-400 transition"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
          <div className="w-3 h-3 border border-primary-400 border-t-transparent rounded-full animate-spin" />
          Searching officers...
        </div>
      ) : officers.length === 0 ? (
        <p className="text-xs text-red-500 py-1">
          {debouncedSearch
            ? `No officers found for "${debouncedSearch}"`
            : 'No available officers of this rank right now'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {officers.map(o => {
              const checked = selectedIds.includes(o._id);
              return (
                <label
                  key={o._id}
                  className={`flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg cursor-pointer border transition-colors select-none
                    ${checked
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-primary-300'
                    }`}
                >
                  <input
                    type="checkbox"
                    className="accent-primary-600 shrink-0"
                    checked={checked}
                    onChange={() => onToggle(o._id)}
                  />
                  <span className="truncate text-gray-800 dark:text-gray-200 text-xs">{o.name}</span>
                  {o.badgeNumber && (
                    <span className="text-xs text-gray-400 ml-auto shrink-0">#{o.badgeNumber}</span>
                  )}
                </label>
              );
            })}
          </div>
          {officers.length >= 50 && !debouncedSearch && (
            <p className="text-xs text-gray-400 text-center pt-1">
              Showing first 50 results — use search to narrow down
            </p>
          )}
        </>
      )}
    </div>
  );
}