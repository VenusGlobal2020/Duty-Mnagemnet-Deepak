import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Search, Crosshair, Check } from 'lucide-react';
import L from 'leaflet';

// Default marker icon paths break under bundlers since Leaflet's CSS
// references relative image URLs that Vite doesn't resolve. We rebuild the
// default icon using the package's bundled image assets, then reuse it everywhere.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [25.4358, 81.8463]; // Prayagraj — sensible fallback for this dataset
const DEFAULT_ZOOM = 13;

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

  // Mount / unmount the actual Leaflet map whenever the modal opens.
  // Leaflet needs a real, visible DOM node at init time, so this only runs post-render.
  useEffect(() => {
    if (!isOpen || !mapElRef.current) return;

    const hasInitial = Number.isFinite(initialLat) && Number.isFinite(initialLng);
    const center = hasInitial ? [initialLat, initialLng] : DEFAULT_CENTER;

    const map = L.map(mapElRef.current, {
      center,
      zoom: hasInitial ? 15 : DEFAULT_ZOOM,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (hasInitial) {
      const m = L.marker(center, { icon: defaultIcon, draggable: true }).addTo(map);
      markerRef.current = m;
      m.on('dragend', () => {
        const { lat, lng } = m.getLatLng();
        setPicked({ lat, lng });
      });
      setPicked({ lat: initialLat, lng: initialLng });
    }

    // Tap/click anywhere on the map drops (or moves) the pin.
    const dropPin = (lat, lng) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const m = L.marker([lat, lng], { icon: defaultIcon, draggable: true }).addTo(map);
        markerRef.current = m;
        m.on('dragend', () => {
          const pos = m.getLatLng();
          setPicked({ lat: pos.lat, lng: pos.lng });
        });
      }
      setPicked({ lat, lng });
    };

    map.on('click', (e) => dropPin(e.latlng.lat, e.latlng.lng));

    // Fix Leaflet's tile sizing — modals render after CSS layout settles, so
    // the canvas can initialize with a stale (zero/partial) size otherwise.
    setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 16);
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else {
          const m = L.marker([latitude, longitude], { icon: defaultIcon, draggable: true }).addTo(mapRef.current);
          markerRef.current = m;
          m.on('dragend', () => {
            const p = m.getLatLng();
            setPicked({ lat: p.lat, lng: p.lng });
          });
        }
        setPicked({ lat: latitude, lng: longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchInput.trim())}`
      );
      const results = await res.json();
      if (results?.[0]) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        mapRef.current?.setView([lat, lng], 15);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const m = L.marker([lat, lng], { icon: defaultIcon, draggable: true }).addTo(mapRef.current);
          markerRef.current = m;
          m.on('dragend', () => {
            const p = m.getLatLng();
            setPicked({ lat: p.lat, lng: p.lng });
          });
        }
        setPicked({ lat, lng });
      }
    } catch {
      // Silent fail — search is a convenience, not a requirement; user can still tap the map directly.
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = () => {
    if (!picked) return;
    onConfirm(picked);
    onClose();
  };

  return (
    <PickerShell onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-ink-200/70 dark:border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-signal-500" />
          <h2 className="text-base font-bold font-display text-ink-900 dark:text-white">ड्यूटी स्थान चुनें</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/[0.06] transition-colors">
          <X className="w-4 h-4 text-ink-500 dark:text-ink-400" />
        </button>
      </div>

      {/* Search + locate row */}
      <div className="flex items-center gap-2 p-3 border-b border-ink-200/70 dark:border-white/[0.06] shrink-0">
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
            disabled={searching}
            className="btn-secondary text-xs px-3 py-1.5 shrink-0"
          >
            {searching ? '...' : 'खोजें'}
          </button>
        </form>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          title="मेरा वर्तमान स्थान उपयोग करें"
          className="btn-secondary text-xs px-3 py-1.5 shrink-0"
        >
          <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Map canvas */}
      <div className="relative flex-1 min-h-[360px]">
        <div ref={mapElRef} className="absolute inset-0" />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] bg-ink-900/90 text-white text-xs px-3 py-1.5 rounded-full font-medium pointer-events-none shadow-lg">
          पिन लगाने के लिए मानचित्र पर कहीं भी टैप करें
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 p-4 border-t border-ink-200/70 dark:border-white/[0.06] shrink-0">
        <div className="text-xs text-ink-500 dark:text-ink-400 font-mono">
          {picked
            ? `${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}`
            : 'अभी तक कोई स्थान नहीं चुना गया'}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-3">रद्द करें</button>
          <button onClick={handleConfirm} disabled={!picked} className="btn-primary text-sm py-1.5 px-3">
            <Check className="w-3.5 h-3.5" /> यह स्थान उपयोग करें
          </button>
        </div>
      </div>
    </PickerShell>
  );
}
