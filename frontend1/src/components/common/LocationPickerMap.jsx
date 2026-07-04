import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Search, Crosshair, Check, AlertTriangle } from 'lucide-react';
import { loadMappls, MAPPLS_KEY } from '../../utils/mapplsLoader';
import api from '../../api/axios';

const DEFAULT_CENTER = { lat: 25.4358, lng: 81.8463 }; // Prayagraj — sensible fallback for this dataset
const DEFAULT_ZOOM = 13;

// Pulls a {lat,lng} pair out of whatever shape a Mappls SDK callback/event
// hands us — the SDK is fairly loose about this (plain {lat,lng} objects in
// some places, [lat,lng] arrays in others, getLngLat()/lat()/lng() accessor
// functions elsewhere) so every place we read a position goes through this
// instead of assuming one specific shape.
function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractLatLng(obj, _depth = 0) {
  if (!obj || _depth > 3) return null;
  if (typeof obj.getLngLat === 'function') return extractLatLng(obj.getLngLat(), _depth + 1);
  if (typeof obj.lat === 'function' && typeof obj.lng === 'function') {
    return { lat: obj.lat(), lng: obj.lng() };
  }

  const fieldPairs = [['lat', 'lng'], ['lat', 'lon'], ['latitude', 'longitude']];
  for (const [latKey, lngKey] of fieldPairs) {
    const lat = toNum(obj[latKey]);
    const lng = toNum(obj[lngKey]);
    if (lat !== null && lng !== null) return { lat, lng };
  }

  // "28.6139,77.2090" style combined string, under various key names
  for (const key of ['location', 'latlng', 'lnglat', 'center']) {
    if (typeof obj[key] === 'string' && obj[key].includes(',')) {
      const parts = obj[key].split(',').map((s) => toNum(s.trim()));
      if (parts[0] !== null && parts[1] !== null) return { lat: parts[0], lng: parts[1] };
    }
  }

  // Nested shapes some SDK responses wrap coordinates in
  for (const key of ['geometry', 'location', 'center', 'latlng', 'position', 'point']) {
    if (obj[key] && typeof obj[key] === 'object') {
      const nested = extractLatLng(obj[key].location || obj[key], _depth + 1);
      if (nested) return nested;
    }
  }

  if (Array.isArray(obj) && obj.length === 2 && Number.isFinite(toNum(obj[0])) && Number.isFinite(toNum(obj[1]))) {
    return { lat: toNum(obj[0]), lng: toNum(obj[1]) };
  }
  return null;
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
// Built directly with a portal (rather than reusing <Modal>) so we get full
// control of internal padding/height for the map canvas, which the shared
// Modal's padded body would otherwise constrain awkwardly.
function PickerShell({ onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div className="fixed top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-ink-800 rounded-xl shadow-2xl border border-ink-200/70 dark:border-white/[0.08] max-h-[90vh] flex flex-col animate-fadeUp overflow-hidden">
        {children}
      </div>
    </div>,
    document.body
  );
}

// ─── Main picker ──────────────────────────────────────────────────────────────
// Props:
//   isOpen, onClose
//   onConfirm({ lat, lng }) — called when user taps "Use this location"
//   initialLat, initialLng — optional, centers map + drops pin if already set
export default function LocationPickerMap({ isOpen, onClose, onConfirm, initialLat, initialLng }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [picked, setPicked] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [resolvingIndex, setResolvingIndex] = useState(-1);

  const resetSearch = () => {
    setSearchResults([]);
    setSearchInput('');
    setSearchError('');
  };

  // Mount / unmount the actual Mappls map whenever the modal opens.
  // Follows the same init sequence proven to work elsewhere in this app
  // (MapView.jsx): assign a real DOM id, force explicit container sizing,
  // wait two animation frames for layout to settle, then construct the map
  // and only touch it once its 'load' event has actually fired.
  useEffect(() => {
    if (!isOpen || !mapElRef.current) return;
    if (!MAPPLS_KEY) { setSdkError(true); return; }

    let destroyed = false;
    setMapReady(false);
    setSdkError(false);

    const hasInitial = Number.isFinite(initialLat) && Number.isFinite(initialLng);
    const center = hasInitial ? { lat: initialLat, lng: initialLng } : DEFAULT_CENTER;

    // Drops (or moves) the draggable pin and records the picked position.
    const dropPin = (lat, lng) => {
      const map = mapRef.current;
      if (!map) return;
      if (markerRef.current) {
        const m = markerRef.current;
        if (typeof m.setLngLat === 'function') m.setLngLat({ lat, lng });
        else if (typeof m.setPosition === 'function') m.setPosition({ lat, lng });
      } else {
        const m = new window.mappls.Marker({ map, position: { lat, lng }, draggable: true, fitbounds: false });
        const onDragEnd = () => {
          const pos = extractLatLng(typeof m.getLngLat === 'function' ? m.getLngLat() : m);
          if (pos) setPicked(pos);
        };
        if (typeof m.addListener === 'function') m.addListener('dragend', onDragEnd);
        else if (typeof m.on === 'function') m.on('dragend', onDragEnd);
        markerRef.current = m;
      }
      setPicked({ lat, lng });
    };

    loadMappls().then(() => {
      if (destroyed || !mapElRef.current) return;

      // Mappls' Map constructor expects the container's DOM id (a string),
      // NOT the element reference itself.
      if (!mapElRef.current.id) {
        mapElRef.current.id = `mappls-picker-${Math.random().toString(36).slice(2)}`;
      }
      mapElRef.current.style.width = '100%';
      mapElRef.current.style.height = '100%';

      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (destroyed || !mapElRef.current) return;

          const map = new window.mappls.Map(mapElRef.current.id, {
            center,
            zoom: hasInitial ? 15 : DEFAULT_ZOOM,
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

            if (hasInitial) dropPin(initialLat, initialLng);

            if (typeof map.addListener === 'function') {
              map.addListener('click', (e) => {
                const pos = extractLatLng(e?.lngLat ?? e?.latlng ?? e);
                if (pos) dropPin(pos.lat, pos.lng);
              });
            }

            setMapReady(true);
          };

          if (typeof map.addListener === 'function') {
            map.addListener('load', onMapReady);
          } else {
            setTimeout(onMapReady, 800);
          }

          const onWindowResize = () => { if (map.resize) map.resize(); };
          window.addEventListener('resize', onWindowResize);
          map.__onWindowResize = onWindowResize;

          let resizeObserver = null;
          if (typeof ResizeObserver !== 'undefined' && mapElRef.current) {
            resizeObserver = new ResizeObserver(() => {
              if (mapRef.current?.resize) mapRef.current.resize();
            });
            resizeObserver.observe(mapElRef.current);
          }
          map.__resizeObserver = resizeObserver;
        });
      });
      mapRef.current = { __raf1: raf1, remove: () => cancelAnimationFrame(raf1) };
    }).catch(() => { if (!destroyed) setSdkError(true); });

    return () => {
      destroyed = true;
      if (mapRef.current?.__onWindowResize) window.removeEventListener('resize', mapRef.current.__onWindowResize);
      if (mapRef.current?.__resizeObserver) mapRef.current.__resizeObserver.disconnect();
      if (markerRef.current) { try { markerRef.current.remove(); } catch { /* ignore */ } }
      markerRef.current = null;
      if (mapRef.current?.remove) mapRef.current.remove();
      mapRef.current = null;
      setPicked(null);
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const moveMarkerTo = (lat, lng) => {
    const map = mapRef.current;
    if (!map || !map.setCenter) return;
    map.setCenter({ lat, lng });
    if (map.setZoom) map.setZoom(16);
    if (markerRef.current) {
      const m = markerRef.current;
      if (typeof m.setLngLat === 'function') m.setLngLat({ lat, lng });
      else if (typeof m.setPosition === 'function') m.setPosition({ lat, lng });
    } else {
      const m = new window.mappls.Marker({ map, position: { lat, lng }, draggable: true, fitbounds: false });
      const onDragEnd = () => {
        const pos = extractLatLng(typeof m.getLngLat === 'function' ? m.getLngLat() : m);
        if (pos) setPicked(pos);
      };
      if (typeof m.addListener === 'function') m.addListener('dragend', onDragEnd);
      else if (typeof m.on === 'function') m.on('dragend', onDragEnd);
      markerRef.current = m;
    }
    setPicked({ lat, lng });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        moveMarkerTo(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Resolves one search result to an actual {lat,lng} and drops the pin
  // there. Search results only carry an eLoc (Mappls' place-id) — not raw
  // coordinates — so this tries, in order: (1) any lat/lng Mappls happens to
  // include directly, (2) the getPinDetails plugin, (3) rendering an
  // eLoc-based marker directly, (4) our own backend, which geocodes the
  // address text via Mappls' Address Verification REST API — a different
  // product from the web-SDK plugins that does return real coordinates.
  const resolveAndSelect = async (item, index) => {
    setSearchError('');
    setResolvingIndex(index);

    const direct = extractLatLng(item);
    if (direct) {
      moveMarkerTo(direct.lat, direct.lng);
      setSearchResults([]);
      setResolvingIndex(-1);
      return;
    }

    // Attempt 1: getPinDetails
    if (item.eLoc && typeof window.mappls?.getPinDetails === 'function') {
      try {
        const details = await new Promise((resolve) => {
          window.mappls.getPinDetails({ pin: item.eLoc }, (d) => resolve(d));
        });
        console.log('[LocationPickerMap] getPinDetails response:', details);
        const list = Array.isArray(details) ? details : [details?.data ?? details];
        const pos = extractLatLng(list[0]);
        if (pos) {
          moveMarkerTo(pos.lat, pos.lng);
          setSearchResults([]);
          setResolvingIndex(-1);
          return;
        }
      } catch (err) {
        console.warn('[LocationPickerMap] getPinDetails threw:', err);
      }
    }

    // Attempt 2: place a marker directly by eLoc via the marker plugin —
    // it resolves eLoc → position internally to actually draw the pin, so
    // reading the resulting marker's position back out sidesteps the
    // lat/lng field being withheld everywhere else.
    if (item.eLoc && typeof window.mappls?.elocMarker === 'function') {
      try {
        const map = mapRef.current;
        const markerObj = await new Promise((resolve, reject) => {
          try {
            const obj = new window.mappls.elocMarker({ map, pin: [item.eLoc], fitbounds: true }, (data) => {
              console.log('[LocationPickerMap] elocMarker response:', data);
              resolve({ obj, data });
            });
            setTimeout(() => resolve({ obj, data: null }), 1500);
          } catch (err) { reject(err); }
        });
        const fromCallback = markerObj.data ? extractLatLng(Array.isArray(markerObj.data) ? markerObj.data[0] : markerObj.data) : null;
        const fromObj = fromCallback || extractLatLng(
          typeof markerObj.obj?.getLngLat === 'function' ? markerObj.obj.getLngLat() : markerObj.obj
        );
        if (fromObj) {
          try { markerObj.obj.remove?.(); } catch { /* ignore */ }
          moveMarkerTo(fromObj.lat, fromObj.lng);
          setSearchResults([]);
          setResolvingIndex(-1);
          return;
        }
        try { markerObj.obj.remove?.(); } catch { /* ignore */ }
      } catch (err) {
        console.warn('[LocationPickerMap] elocMarker threw:', err);
      }
    }

    // Attempt 3: our backend, geocoding the address text via Mappls'
    // Address Verification REST API (a different product from the web-SDK
    // plugins — this one does return real coordinates on this account).
    const addressToGeocode = item.placeAddress || item.address || item.placeName || item.name;
    if (addressToGeocode) {
      try {
        const center = mapRef.current?.getCenter ? extractLatLng(mapRef.current.getCenter()) : null;
        const { data } = await api.post('/mappls/geocode', {
          address: addressToGeocode,
          lat: center?.lat,
          lng: center?.lng,
        });
        console.log('[LocationPickerMap] backend geocode response:', data);
        const pos = extractLatLng(data?.data);
        if (pos) {
          moveMarkerTo(pos.lat, pos.lng);
          setSearchResults([]);
          setResolvingIndex(-1);
          return;
        }
      } catch (err) {
        console.warn('[LocationPickerMap] backend geocode failed:', err?.response?.data || err.message);
      }
    }

    console.error('[LocationPickerMap] Could not resolve to coordinates via any method for:', item);
    setSearchError('इस स्थान के निर्देशांक नहीं मिल सके। कृपया मानचित्र पर सीधे टैप करके स्थान चुनें।');
    setResolvingIndex(-1);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;
    setSearchError('');
    setSearchResults([]);
    setSearching(true);

    // Give the plugin one more chance to load right now (it retries and
    // logs the real reason to the console if it fails) instead of just
    // giving up if it wasn't ready when the map first opened.
    try {
      await loadMappls();
    } catch { /* base map already loaded if we got this far; ignore */ }

    if (!window.mappls || typeof window.mappls.search !== 'function') {
      console.error('[LocationPickerMap] window.mappls.search is unavailable — check the console above for why the plugin script failed.');
      setSearchError('स्थान खोज अभी उपलब्ध नहीं है। मानचित्र पर सीधे टैप करें, या ब्राउज़र कंसोल में error देखें।');
      setSearching(false);
      return;
    }

    const center = mapRef.current?.getCenter ? extractLatLng(mapRef.current.getCenter()) : null;
    const options = center ? { location: [center.lat, center.lng] } : {};

    try {
      const list = await new Promise((resolve, reject) => {
        try {
          // eslint-disable-next-line no-new
          new window.mappls.search(query, options, (data) => {
            console.log('[LocationPickerMap] mappls.search raw response:', data);
            resolve(Array.isArray(data) ? data : (data?.results || data?.suggestedLocations || []));
          });
        } catch (err) {
          reject(err);
        }
      });

      if (!list.length) {
        setSearchError('कोई परिणाम नहीं मिला। कोई और नाम/पता आज़माएं, या मानचित्र पर सीधे टैप करें।');
      } else {
        setSearchResults(list.slice(0, 8));
      }
    } catch (err) {
      console.error('[LocationPickerMap] mappls.search threw an error:', err);
      setSearchError('खोज में समस्या हुई। मानचित्र पर सीधे टैप करके स्थान चुनें।');
    } finally {
      setSearching(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetSearch();
  };

  const handleConfirm = () => {
    if (!picked) return;
    onConfirm(picked);
    onClose();
    resetSearch();
  };

  return (
    <PickerShell onClose={handleClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-ink-200/70 dark:border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-signal-500" />
          <h2 className="text-base font-bold font-display text-ink-900 dark:text-white">ड्यूटी स्थान चुनें</h2>
        </div>
        <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/[0.06] transition-colors">
          <X className="w-4 h-4 text-ink-500 dark:text-ink-400" />
        </button>
      </div>

      {/* Search + locate row */}
      <div className="relative flex items-center gap-2 p-3 border-b border-ink-200/70 dark:border-white/[0.06] shrink-0">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="कोई स्थान या पता खोजें..."
              className="input-field pl-8 text-sm py-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !mapReady}
            className="btn-secondary text-xs px-3 py-1.5 shrink-0"
          >
            {searching ? '...' : 'खोजें'}
          </button>
        </form>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating || !mapReady}
          title="मेरा वर्तमान स्थान उपयोग करें"
          className="btn-secondary text-xs px-3 py-1.5 shrink-0"
        >
          <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
        </button>

        {searchResults.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-ink-800 border border-ink-200/70 dark:border-white/[0.08] rounded-lg shadow-xl z-[1000000]">
            {searchResults.map((item, idx) => (
              <button
                key={item.eLoc || idx}
                type="button"
                onClick={() => {
                  resolveAndSelect(item, idx);
                  setSearchInput("")
                  setSearchResults([])
                }}
                disabled={resolvingIndex !== -1}
                className="w-full text-left px-3 py-2 hover:bg-ink-100 dark:hover:bg-white/[0.06] transition-colors border-b border-ink-100 dark:border-white/[0.04] last:border-b-0 disabled:opacity-60"
              >
                <div className="text-sm font-medium text-ink-900 dark:text-white truncate">
                  {resolvingIndex === idx ? 'ढूंढ रहे हैं...' : (item.placeName || item.name || 'स्थान')}
                </div>
                {item.placeAddress && (
                  <div className="text-xs text-ink-500 dark:text-ink-400 truncate">{item.placeAddress}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {searchError && (
        <div className="px-3 py-1.5 text-xs text-signal-600 dark:text-signal-400 bg-signal-50 dark:bg-signal-900/20 border-b border-ink-200/70 dark:border-white/[0.06]">
          {searchError}
        </div>
      )}

      {/* Map canvas */}
      <div className="relative h-[55vh] min-h-[300px]">
        <div ref={mapElRef} className="absolute inset-0" />
        {sdkError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6 bg-ink-50 dark:bg-ink-800/60">
            <AlertTriangle className="w-6 h-6 text-signal-500" />
            <p className="text-sm text-ink-500 dark:text-ink-400">मानचित्र लोड नहीं हो सका। कृपया पुनः प्रयास करें।</p>
          </div>
        )}
        {!sdkError && !mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-50 dark:bg-ink-800/60">
            <div className="w-6 h-6 border-2 border-signal2-300 border-t-signal2-500 rounded-full animate-spin" />
          </div>
        )}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] bg-ink-900/90 text-white text-xs px-3 py-1.5 rounded-full font-medium pointer-events-none shadow-lg">
          पिन लगाने के लिए मानचित्र पर कहीं भी टैप करें
        </div>
      </div>

      {/* Footer */}
      <div className="flex md:flex-row flex-col items-center justify-between gap-3 p-4 border-t border-ink-200/70 dark:border-white/[0.06] shrink-0">
        <div className="text-xs text-ink-500 dark:text-ink-400 font-mono">
          {picked
            ? `${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}`
            : 'अभी तक कोई स्थान नहीं चुना गया'}
        </div>
        <div className="flex gap-2">
          <button onClick={handleClose} className="btn-secondary text-sm py-1.5 px-3">रद्द करें</button>
          <button onClick={handleConfirm} disabled={!picked} className="btn-primary text-sm py-1.5 px-3">
            <Check className="w-3.5 h-3.5" /> यह स्थान उपयोग करें
          </button>
        </div>
      </div>
    </PickerShell>
  );
}