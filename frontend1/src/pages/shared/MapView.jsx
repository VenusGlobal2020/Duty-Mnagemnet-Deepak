import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, Layers, Loader2, Clock, Users, ShieldAlert,
  Navigation, ExternalLink, ChevronDown
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import {
  formatDateTime, getPriorityColor, getPriorityLabel, getStatusColor, apiError
} from '../../utils/helpers';
import { loadMappls, MAPPLS_KEY } from '../../utils/mapplsLoader';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const STATUS_META = {
  active:    { label: 'Active',    dot: '#22D3EE', ring: 'rgba(34,211,238,0.35)' },
  draft:     { label: 'Drafted',   dot: '#F8B324', ring: 'rgba(248,179,36,0.35)' },
  completed: { label: 'Completed', dot: '#34D399', ring: 'rgba(52,211,153,0.30)' },
  cancelled: { label: 'Cancelled', dot: '#F87171', ring: 'rgba(248,113,113,0.30)' },
};

const DEFAULT_CENTER = { lat: 25.4358, lng: 81.8463 };

// Builds the same small circular dot-in-ring "dot aur circle" HTML marker as
// before, now rendered through Mappls' HTML marker option instead of a
// Leaflet divIcon.
function buildMarkerHtml(label, statusKey) {
  const meta = STATUS_META[statusKey] || STATUS_META.active;
  return `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="
        width:18px;height:18px;border-radius:50%;
        background:${meta.dot};
        box-shadow:0 0 0 6px ${meta.ring}, 0 1px 4px rgba(0,0,0,0.45);
        border:2px solid rgba(255,255,255,0.9);
      "></div>
      <div style="
        margin-top:3px;font-size:10px;font-weight:600;font-family:Inter,sans-serif;
        color:#0B1220;background:rgba(255,255,255,0.92);
        padding:1px 6px;border-radius:8px;white-space:nowrap;
        max-width:120px;overflow:hidden;text-overflow:ellipsis;
        box-shadow:0 1px 3px rgba(0,0,0,0.25);
      ">${label}</div>
    </div>`;
}

function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ─── Mappls canvas (raw window.mappls usage — same proven pattern as the
// rest of this app's Mappls integration) ───────────────────────────────────
function MapCanvas({ duties, onMarkerClick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);

  useEffect(() => {
    if (!elRef.current) return;
    if (!MAPPLS_KEY) { setSdkError(true); return; }
    let destroyed = false;

    loadMappls().then(() => {
      if (destroyed || !elRef.current) return;

      // Mappls' Map constructor expects the container's DOM id (a string),
      // NOT the element reference itself — passing the node directly makes
      // the SDK log "Map container not defined!!" and silently fall back to
      // a broken map object that crashes later when a marker attaches.
      if (!elRef.current.id) {
        elRef.current.id = `mappls-mapview-${Math.random().toString(36).slice(2)}`;
      }

      // Belt-and-braces sizing: make sure the container itself always has
      // real, explicit dimensions regardless of what CSS utility classes
      // actually made it into the Tailwind build.
      elRef.current.style.width = '100%';
      elRef.current.style.height = '100%';

      // Wait two animation frames before constructing the map. React swaps
      // the loading spinner for this container in the same tick the data
      // finishes loading — without this delay, the browser hasn't
      // necessarily committed the container's final layout yet, so the SDK
      // reads a stale/zero height when it first measures the container and
      // never fully recovers even after calling resize() later.
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          if (destroyed || !elRef.current) return;

          const map = new window.mappls.Map(elRef.current.id, {
            center: DEFAULT_CENTER,
            zoom: 12,
          });
          mapRef.current = map;

          // Wait for the map's actual 'load' event before touching it — a
          // fixed setTimeout guessed at this and intermittently fired
          // before the internal canvas/style was ready, causing
          // "t.getCanvasContainer is not a function" when adding markers.
          const markReady = () => {
            if (destroyed) return;
            // Force several resize passes: once immediately, and again
            // shortly after, in case the SDK does its own internal layout
            // work right after 'load' that overwrites a too-early resize.
            const doResize = () => { if (map.resize) map.resize(); };
            doResize();
            setTimeout(doResize, 100);
            setTimeout(doResize, 400);
            setReady(true);
          };
          if (typeof map.addListener === 'function') {
            map.addListener('load', markReady);
          } else {
            // Fallback for SDK builds without a 'load' event
            setTimeout(markReady, 800);
          }

          const onWindowResize = () => { if (map.resize) map.resize(); };
          window.addEventListener('resize', onWindowResize);
          map.__onWindowResize = onWindowResize;

          // Keep the canvas in sync with the container going forward too —
          // sidebar toggles, or the stats strip showing/hiding above the
          // map, change the container's size after initial load.
          let resizeObserver = null;
          if (typeof ResizeObserver !== 'undefined' && elRef.current) {
            resizeObserver = new ResizeObserver(() => {
              if (mapRef.current?.resize) mapRef.current.resize();
            });
            resizeObserver.observe(elRef.current);
          }
          map.__resizeObserver = resizeObserver;
        });
      });
      mapRef.current = { __raf1: raf1, remove: () => cancelAnimationFrame(raf1) };
    }).catch(() => setSdkError(true));

    return () => {
      destroyed = true;
      if (mapRef.current?.__onWindowResize) window.removeEventListener('resize', mapRef.current.__onWindowResize);
      if (mapRef.current?.__resizeObserver) mapRef.current.__resizeObserver.disconnect();
      markersRef.current.forEach((m) => { try { m.remove(); } catch { /* ignore */ } });
      markersRef.current = [];
      if (mapRef.current?.remove) mapRef.current.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Clear old markers before re-drawing the new filtered set
    markersRef.current.forEach((m) => { try { m.remove(); } catch { /* ignore */ } });
    markersRef.current = [];

    const valid = (duties || []).filter(d => isValidCoord(d.location?.lat, d.location?.lng));

    valid.forEach((duty) => {
      const marker = new window.mappls.Marker({
        map,
        position: { lat: duty.location.lat, lng: duty.location.lng },
        html: buildMarkerHtml(duty.dutyName, duty.status),
        fitbounds: false,
      });
      marker.addListener('click', () => onMarkerClick(duty));
      markersRef.current.push(marker);
    });

    if (valid.length === 0) {
      if (map.setCenter) map.setCenter(DEFAULT_CENTER);
      if (map.setZoom) map.setZoom(12);
    } else if (valid.length === 1) {
      if (map.setCenter) map.setCenter({ lat: valid[0].location.lat, lng: valid[0].location.lng });
      if (map.setZoom) map.setZoom(15);
    } else if (window.mappls.LatLngBounds && map.fitBounds) {
      // Fit the view to every marker — computed manually rather than relying
      // on a per-marker `fitbounds` flag, since we couldn't confirm that
      // option's exact behavior against a live key.
      try {
        const bounds = new window.mappls.LatLngBounds();
        valid.forEach(d => bounds.extend({ lat: d.location.lat, lng: d.location.lng }));
        map.fitBounds(bounds, { padding: 60 });
      } catch {
        // fall back to just centering on the first marker
        if (map.setCenter) map.setCenter({ lat: valid[0].location.lat, lng: valid[0].location.lng });
      }
    }
  }, [duties, ready]);

  if (sdkError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 bg-ink-50 dark:bg-ink-800/60 p-6">
        <MapPin className="w-8 h-8 text-ink-300" />
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Mappls API key सेट नहीं है। कृपया <code>VITE_MAPPLS_API_KEY</code> .env में जोड़ें।
        </p>
      </div>
    );
  }

  return <div ref={elRef} className="absolute inset-0" />;
}

// ─── Duty detail modal ────────────────────────────────────────────────────────
function DutyDetailModal({ duty, onClose }) {
  if (!duty) return null;
  const mapsLink = duty.location?.lat && duty.location?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${duty.location.lat},${duty.location.lng}`
    : null;

  return (
    <Modal isOpen={!!duty} onClose={onClose} title="Duty Details" size="sm">
      <div className="space-y-4">
        <div>
          <h3 className="font-bold text-ink-900 dark:text-white text-base">{duty.dutyName}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-ink-500">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {duty.locationName}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`badge ${getStatusColor(duty.status)}`}>{duty.status}</span>
          <span className={`badge border ${getPriorityColor(duty.priority)}`}>{getPriorityLabel(duty.priority)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-ink-50 dark:bg-ink-800 rounded-lg p-2.5">
            <p className="text-xs text-ink-400 mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Start</p>
            <p className="font-medium text-ink-800 dark:text-ink-200">{formatDateTime(duty.startDate)}</p>
          </div>
          <div className="bg-ink-50 dark:bg-ink-800 rounded-lg p-2.5">
            <p className="text-xs text-ink-400 mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> End</p>
            <p className="font-medium text-ink-800 dark:text-ink-200">{formatDateTime(duty.endDate)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm bg-ink-50 dark:bg-ink-800 rounded-lg p-2.5">
          <span className="flex items-center gap-1.5 text-ink-500"><Users className="w-3.5 h-3.5" /> Officers Assigned</span>
          <span className="font-semibold text-ink-800 dark:text-ink-200">{duty.officersCount ?? 0}</span>
        </div>

        {(duty.operatorName || duty.adminName) && (
          <div className="text-sm space-y-1 text-ink-500">
            {duty.adminName && <p>Admin: <span className="text-ink-700 dark:text-ink-300 font-medium">{duty.adminName}</span></p>}
            {duty.operatorName && <p>Operator: <span className="text-ink-700 dark:text-ink-300 font-medium">{duty.operatorName}</span></p>}
          </div>
        )}

        {mapsLink && (
          <a href={mapsLink} target="_blank" rel="noopener noreferrer"
            className="btn-secondary w-full justify-center text-sm">
            <ExternalLink className="w-3.5 h-3.5" /> Open in Google Maps
          </a>
        )}
      </div>
    </Modal>
  );
}

// ─── Cascading filter bar ──────────────────────────────────────────────────────
function FilterSelect({ label, value, onChange, options, disabled, placeholder }) {
  return (
    <div className="flex-1 min-w-[160px]">
      <label className="form-label text-xs">{label}</label>
      <div className="relative">
        <select
          className="input-field text-sm appearance-none pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────────
function Legend({ statuses }) {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs text-ink-500 dark:text-ink-400">
      {statuses.map(s => {
        const meta = STATUS_META[s] || STATUS_META.active;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: meta.dot }} />
            {meta.label}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
// role drives which dropdown levels render and which API endpoints are hit:
//   master / superadmin → Admin dropdown → Operator dropdown → Status dropdown
//   admin               → Operator dropdown → Status dropdown
//   operator            → Status dropdown only (own duties)
//   officer              → no dropdowns (own active duties only)
export default function MapView() {
  const { user } = useAuth();
  const role = user?.role;
  const isMasterOrSuperadmin = role === 'master' || role === 'superadmin';
  const isAdmin = role === 'admin';
  const isOperator = role === 'operator_special' || role === 'operator_regular';
  const isOfficer = role === 'officer';

  const basePath = role === 'master' ? '/master'
    : role === 'superadmin' ? '/superadmin'
    : role === 'admin' ? '/admin'
    : '/operator';

  const [adminId, setAdminId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [status, setStatus] = useState('active');
  const [selectedDuty, setSelectedDuty] = useState(null);

  // ── Admin list (master / superadmin only) ──
  const { data: admins = [], isLoading: adminsLoading } = useQuery({
    queryKey: ['mapview-admins', role],
    queryFn: () => api.get(`${basePath}/admins?limit=200`).then(r => r.data.data.data || []),
    enabled: isMasterOrSuperadmin,
  });

  // ── Operator list ──
  // master/superadmin: depends on the chosen admin. admin: their own operators, no dependency.
  const { data: operatorsRaw, isLoading: operatorsLoading } = useQuery({
    queryKey: ['mapview-operators', role, adminId],
    queryFn: () => {
      if (isAdmin) return api.get('/admin/operators').then(r => r.data.data.operators);
      return api.get(`${basePath}/admins/${adminId}/details`).then(r => r.data.data.operators);
    },
    enabled: isAdmin || (isMasterOrSuperadmin && !!adminId),
  });
  const operators = operatorsRaw || [];

  // Reset downstream selections when an upstream dropdown changes
  useEffect(() => { setOperatorId(''); }, [adminId]);

  // ── Duties for the map ──
  const operatorOwnView = isOperator;
  const officerView = isOfficer;

  const dutiesQueryEnabled = officerView
    ? true
    : operatorOwnView
      ? true
      : isAdmin
        ? true
        : isMasterOrSuperadmin
          ? !!adminId  // require an admin pick before hitting the duties endpoint
          : false;

  const { data: duties = [], isLoading: dutiesLoading, isFetching: dutiesFetching, error: dutiesError } = useQuery({
    queryKey: ['mapview-duties', role, adminId, operatorId, status],
    queryFn: async () => {
      if (officerView) {
        // Officers see their own upcoming (draft) and live (active) assignments
        // from this one endpoint — the drafted/active split below is what tells
        // them apart in the UI, the cron job is what promotes draft -> active.
        const list = await api.get('/officer/duties/active').then(r => r.data.data.duties);
        return list;
      }
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (operatorOwnView) {
        return api.get(`/operator/duties/map?${params}`).then(r => r.data.data.duties);
      }
      if (isAdmin) {
        if (operatorId) params.set('operatorId', operatorId);
        return api.get(`/admin/duties/map?${params}`).then(r => r.data.data.duties);
      }
      // master / superadmin
      if (adminId) params.set('adminId', adminId);
      if (operatorId) params.set('operatorId', operatorId);
      return api.get(`${basePath}/duties/map?${params}`).then(r => r.data.data.duties);
    },
    enabled: dutiesQueryEnabled,
  });

  useEffect(() => {
    if (dutiesError) toast.error(apiError(dutiesError));
  }, [dutiesError]);

  const draftedCount = useMemo(() => duties.filter(d => d.status === 'draft').length, [duties]);
  const activeCount = useMemo(() => duties.filter(d => d.status === 'active').length, [duties]);
  const plottedCount = useMemo(
    () => duties.filter(d => isValidCoord(d.location?.lat, d.location?.lng)).length,
    [duties]
  );

  const adminOptions = admins.map(a => ({ value: a._id, label: a.name }));
  const operatorOptions = operators.map(o => ({
    value: o._id,
    label: `${o.name}${o.role === 'operator_special' ? ' (Special)' : o.role === 'operator_regular' ? ' (Regular)' : ''}`,
  }));
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Drafted' },
  ];

  const isLoadingAny = adminsLoading || operatorsLoading || dutiesLoading;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-ink-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-signal-500" /> Map View
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            {officerView
              ? 'Your active duty locations on the map'
              : operatorOwnView
                ? 'Your duties plotted by location and status'
                : 'Drill down to see duty locations for any admin / operator'}
          </p>
        </div>
        {dutiesFetching && !dutiesLoading && (
          <span className="text-xs text-ink-400 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Refreshing...
          </span>
        )}
      </div>

      {/* Filters */}
      {!officerView && (
        <div className="card p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
          {isMasterOrSuperadmin && (
            <FilterSelect
              label="Admin"
              value={adminId}
              onChange={setAdminId}
              options={adminOptions}
              placeholder={adminsLoading ? 'Loading...' : 'Select Admin'}
            />
          )}
          {(isAdmin || (isMasterOrSuperadmin && adminId)) && (
            <FilterSelect
              label="Operator"
              value={operatorId}
              onChange={setOperatorId}
              options={operatorOptions}
              placeholder={operatorsLoading ? 'Loading...' : 'All Operators'}
            />
          )}
          <FilterSelect
            label="Duty Status"
            value={status}
            onChange={setStatus}
            options={statusOptions}
            placeholder="All Status"
          />
        </div>
      )}

      {/* Stats strip */}
      {!isLoadingAny && (officerView || operatorOwnView || isAdmin || adminId) && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-signal2-400" />
            <span className="text-ink-500 dark:text-ink-400">Active:</span>
            <span className="font-bold text-ink-800 dark:text-white">{officerView ? duties.length : activeCount}</span>
          </div>
          {!officerView && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-signal-400" />
              <span className="text-ink-500 dark:text-ink-400">Drafted:</span>
              <span className="font-bold text-ink-800 dark:text-white">{draftedCount}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm">
            <MapPin className="w-3.5 h-3.5 text-ink-400" />
            <span className="text-ink-500 dark:text-ink-400">Plotted on map:</span>
            <span className="font-bold text-ink-800 dark:text-white">{plottedCount}</span>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="card p-0 overflow-hidden">
        <div className="relative h-[60vh] min-h-[420px]">
          {isMasterOrSuperadmin && !adminId ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 bg-ink-50 dark:bg-ink-800/60 p-6">
              <ShieldAlert className="w-8 h-8 text-ink-300" />
              <p className="text-sm text-ink-500 dark:text-ink-400">Select an Admin above to view duty locations</p>
            </div>
          ) : isLoadingAny ? (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-50 dark:bg-ink-800/60">
              <div className="w-6 h-6 border-2 border-signal2-300 border-t-signal2-500 rounded-full animate-spin" />
            </div>
          ) : duties.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 bg-ink-50 dark:bg-ink-800/60 p-6">
              <MapPin className="w-8 h-8 text-ink-300" />
              <p className="text-sm text-ink-500 dark:text-ink-400">No duties found for this selection</p>
            </div>
          ) : (
            <MapCanvas duties={duties} onMarkerClick={setSelectedDuty} />
          )}
        </div>
        <div className="p-3 border-t border-ink-200/70 dark:border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <Legend statuses={officerView ? ['active'] : ['active', 'draft']} />
          <p className="text-xs text-ink-400 flex items-center gap-1">
            <Navigation className="w-3 h-3" /> Tap a marker label for full duty details
          </p>
        </div>
      </div>

      <DutyDetailModal duty={selectedDuty} onClose={() => setSelectedDuty(null)} />
    </div>
  );
}