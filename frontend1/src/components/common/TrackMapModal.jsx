import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Route, AlertTriangle, MapPin } from 'lucide-react';
import { loadMappls, MAPPLS_KEY } from '../../utils/mapplsLoader';
import api from '../../api/axios';
import { formatDateTime } from '../../utils/helpers';

const DEFAULT_CENTER = { lat: 25.1337, lng: 82.5644 }; // Mirzapur — same fallback used elsewhere in this app
const DEFAULT_ZOOM = 13;

function formatDistance(meters) {
  if (meters == null) return '—';
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

function formatDur(startISO, endISO) {
  if (!startISO || !endISO) return '—';
  const mins = Math.round((new Date(endISO) - new Date(startISO)) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Track / Route map modal ──────────────────────────────────────────────────
// Shows the GPS route recorded by the officer's mobile app during ONE
// specific attendance (check-in → check-out) shift, drawn as a polyline on
// a Mappls map with start/end markers.
//
// Props:
//   attendanceId — the Attendance record whose track to fetch & draw
//   officerName  — just for the header (cosmetic; falls back to API data)
//   onClose
export default function TrackMapModal({ attendanceId, officerName, onClose }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance-track', attendanceId],
    queryFn: () => api.get(`/attendance/${attendanceId}/track`).then(r => r.data.data),
    enabled: !!attendanceId,
  });

  const points = data?.points || [];

  const clearShapes = () => {
    markersRef.current.forEach((m) => {
      if (typeof m.remove === 'function') m.remove();
      else if (typeof m.setMap === 'function') m.setMap(null);
    });
    markersRef.current = [];
    if (polylineRef.current) {
      if (typeof polylineRef.current.remove === 'function') polylineRef.current.remove();
      else if (typeof polylineRef.current.setMap === 'function') polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
  };

  // Mount the map once, the same init sequence proven to work elsewhere in
  // this app (LocationPickerMap.jsx / MapView.jsx): real DOM id, forced
  // container sizing, two animation frames for layout to settle, then
  // construct the map and only touch it once its 'load' event has fired.
  useEffect(() => {
    if (!mapElRef.current) return;
    if (!MAPPLS_KEY) { setSdkError(true); return; }

    let destroyed = false;
    let raf1 = null;

    loadMappls()
      .then(() => {
        if (destroyed || !mapElRef.current) return;

        if (!mapElRef.current.id) {
          mapElRef.current.id = `mappls-track-${Math.random().toString(36).slice(2)}`;
        }
        mapElRef.current.style.width = '100%';
        mapElRef.current.style.height = '100%';

        raf1 = requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (destroyed || !mapElRef.current) return;

            const map = new window.mappls.Map(mapElRef.current.id, {
              center: DEFAULT_CENTER,
              zoom: DEFAULT_ZOOM,
              zoomControl: true,
            });
            mapRef.current = map;

            const onMapReady = () => {
              if (destroyed) return;
              const doResize = () => {
                if (map.resize) map.resize();
                window.dispatchEvent(new Event('resize'));
              };
              doResize();
              setTimeout(doResize, 100);
              setTimeout(doResize, 400);
              setTimeout(doResize, 900);
              setMapReady(true);
            };

            if (typeof map.addListener === 'function') {
              map.addListener('load', onMapReady);
            } else {
              setTimeout(onMapReady, 800);
            }
          });
        });
      })
      .catch(() => { if (!destroyed) setSdkError(true); });

    return () => {
      destroyed = true;
      if (raf1) cancelAnimationFrame(raf1);
      clearShapes();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw (or redraw) the route once the map is ready AND track data has
  // arrived. Re-runs safely if either changes.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mappls) return;
    clearShapes();

    const map = mapRef.current;
    if (points.length === 0) return;

    const path = points.map((p) => ({ lat: p.lat, lng: p.lng }));

    try {
      polylineRef.current = new window.mappls.Polyline({
        map,
        path,
        strokeColor: '#2563eb',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        fitbounds: true,
      });
    } catch (err) {
      console.warn('[TrackMapModal] Polyline draw failed:', err.message);
      if (map.fitBounds) {
        try { map.fitBounds(path); } catch (_e) { /* ignore */ }
      }
    }

    try {
      const startMarker = new window.mappls.Marker({ map, position: path[0], fitbounds: false });
      markersRef.current.push(startMarker);
      if (path.length > 1) {
        const endMarker = new window.mappls.Marker({ map, position: path[path.length - 1], fitbounds: false });
        markersRef.current.push(endMarker);
      }
    } catch (err) {
      console.warn('[TrackMapModal] Marker draw failed:', err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, points]);

  return createPortal(
    <div className="fixed top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white dark:bg-ink-800 rounded-xl shadow-2xl border border-ink-200/70 dark:border-white/[0.08] max-h-[90vh] flex flex-col overflow-hidden animate-fadeUp">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-200/70 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Route className="w-4 h-4 text-primary-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold font-display text-ink-900 dark:text-white truncate">
                Track — {officerName || data?.officer?.name || 'Officer'}
              </h2>
              {data?.date && <p className="text-xs text-ink-400">{data.date}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/[0.06] transition-colors shrink-0">
            <X className="w-4 h-4 text-ink-500 dark:text-ink-400" />
          </button>
        </div>

        {/* Stats bar */}
        {!isLoading && data && (
          <div className="grid grid-cols-3 gap-2 p-3 border-b border-ink-200/70 dark:border-white/[0.06] shrink-0">
            {/* <div className="text-center">
              <p className="text-sm font-bold text-ink-900 dark:text-white">{formatDistance(data.totalDistanceMeters)}</p>
              <p className="text-[10px] text-ink-400 uppercase tracking-wide">Distance</p>
            </div> */}
            <div className="text-center">
              <p className="text-sm font-bold text-ink-900 dark:text-white">{data.pointCount || 0}</p>
              <p className="text-[10px] text-ink-400 uppercase tracking-wide">Points</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-ink-900 dark:text-white">{formatDur(data.firstPointAt, data.lastPointAt)}</p>
              <p className="text-[10px] text-ink-400 uppercase tracking-wide">Tracked Duration</p>
            </div>
          </div>
        )}

        {/* Map canvas */}
        <div className="relative h-[55vh] min-h-[320px]">
          <div ref={mapElRef} className="absolute inset-0" />

          {sdkError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6 bg-ink-50 dark:bg-ink-800/60">
              <AlertTriangle className="w-6 h-6 text-signal-500" />
              <p className="text-sm text-ink-500 dark:text-ink-400">Could not load the map. Please try again.</p>
            </div>
          )}

          {!sdkError && (isLoading || !mapReady) && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-50 dark:bg-ink-800/60">
              <div className="w-6 h-6 border-2 border-signal2-300 border-t-signal2-500 rounded-full animate-spin" />
            </div>
          )}

          {isError && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6 bg-ink-50 dark:bg-ink-800/60">
              <AlertTriangle className="w-6 h-6 text-signal-500" />
              <p className="text-sm text-ink-500 dark:text-ink-400">Could not load track data.</p>
            </div>
          )}

          {!isLoading && !isError && mapReady && points.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6 bg-ink-50/90 dark:bg-ink-800/80 pointer-events-none">
              <MapPin className="w-6 h-6 text-ink-400" />
              <p className="text-sm text-ink-500 dark:text-ink-400">No tracking points were recorded for this shift.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-ink-200/70 dark:border-white/[0.06] shrink-0">
          <div className="text-xs text-ink-400 space-x-3">
            {data?.checkedInAt && <span>Checked in: {formatDateTime(data.checkedInAt)}</span>}
            {data?.checkedOutAt && <span>Checked out: {formatDateTime(data.checkedOutAt)}</span>}
          </div>
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-3">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}