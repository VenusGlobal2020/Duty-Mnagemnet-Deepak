// Loads the Mappls Vector Maps SDK the same way it's proven to work in the
// HS project (raw <script> tag + window.mappls), instead of going through
// the mappls-web-maps npm package's initialize() wrapper — that wrapper's
// auth-mode handling kept 401'ing with this Console key even with
// auth:'legacy' set, whereas this exact script URL is confirmed working in
// production for this same key.

export const MAPPLS_KEY = import.meta.env.VITE_MAPPLS_API_KEY;

let loadPromise = null;

// Resolves once window.mappls is ready to use. Safe to call from multiple
// components — the first call injects the script, everyone else just waits
// on (or immediately gets) the same promise.
export function loadMappls() {
  if (!MAPPLS_KEY) {
    return Promise.reject(new Error('VITE_MAPPLS_API_KEY is not set'));
  }
  if (loadPromise) return loadPromise;

  const loadPluginsScript = () => new Promise((resolve) => {
    // Best-effort: the address-search box needs this, but the map itself
    // doesn't, so a failure here should never block map rendering.
    if (window.mappls && window.mappls.search) { resolve(); return; }
    const script = document.createElement('script');
    script.src = `https://apis.mappls.com/advancedmaps/api/${MAPPLS_KEY}/map_sdk_plugins?v=3.0&libraries=search`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // swallow — search box will just stay inert
    document.head.appendChild(script);
  });

  loadPromise = new Promise((resolve, reject) => {
    if (window.mappls && window.mappls.Map) {
      loadPluginsScript().then(() => resolve(window.mappls));
      return;
    }

    const existing = document.querySelector('script[src*="mappls.com"][src*="map_sdk?"]');
    if (existing) {
      existing.addEventListener('load', () => setTimeout(() => loadPluginsScript().then(() => resolve(window.mappls)), 500));
      existing.addEventListener('error', () => reject(new Error('Failed to load Mappls SDK')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://apis.mappls.com/advancedmaps/api/${MAPPLS_KEY}/map_sdk?layer=vector&v=3.0`;
    script.async = true;
    script.onload = () => setTimeout(() => loadPluginsScript().then(() => resolve(window.mappls)), 500);
    script.onerror = () => reject(new Error('Failed to load Mappls SDK'));
    document.head.appendChild(script);
  });

  return loadPromise;
}