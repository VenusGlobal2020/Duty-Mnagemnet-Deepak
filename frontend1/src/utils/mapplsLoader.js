// Loads the Mappls Vector Maps SDK the same way it's proven to work in the
// HS project (raw <script> tag + window.mappls), instead of going through
// the mappls-web-maps npm package's initialize() wrapper — that wrapper's
// auth-mode handling kept 401'ing with this Console key even with
// auth:'legacy' set, whereas this exact script URL is confirmed working in
// production for this same key.
//
// Search no longer goes through this SDK at all — it's handled entirely by
// our own backend (GET /api/mappls/search + POST /api/mappls/geocode),
// which calls Mappls' static-key REST APIs directly. That means this loader
// only has one job: load the base map_sdk (tile rendering + the Marker
// class used to drop pins by lat/lng), using the static VITE_MAPPLS_API_KEY.
// There's no more OAuth-gated map_sdk_plugins bundle to load, so there's
// only one place this can fail now (this script), instead of two.
export const MAPPLS_KEY = import.meta.env.VITE_MAPPLS_API_KEY;

let mapLoadPromise = null; // caches the base map_sdk load — safe to reuse across every component that needs a map

// Resolves once window.mappls (the base map) is ready to use. Safe to call
// from multiple components — the first call injects the script, everyone
// else just waits on (or immediately gets) the same promise.
export function loadMappls() {
  if (!MAPPLS_KEY) {
    return Promise.reject(new Error('VITE_MAPPLS_API_KEY is not set'));
  }
  if (mapLoadPromise) return mapLoadPromise;

  mapLoadPromise = new Promise((resolve, reject) => {
    if (window.mappls && window.mappls.Map) {
      resolve(window.mappls);
      return;
    }

    const existing = document.querySelector('script[src*="mappls.com"][src*="map_sdk?"]');
    if (existing) {
      existing.addEventListener('load', () => setTimeout(() => resolve(window.mappls), 500));
      existing.addEventListener('error', () => reject(new Error('Failed to load Mappls SDK')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://apis.mappls.com/advancedmaps/api/${MAPPLS_KEY}/map_sdk?layer=vector&v=3.0`;
    script.async = true;
    script.onload = () => setTimeout(() => resolve(window.mappls), 500);
    script.onerror = () => reject(new Error('Failed to load Mappls SDK'));
    document.head.appendChild(script);
  });

  return mapLoadPromise;
}