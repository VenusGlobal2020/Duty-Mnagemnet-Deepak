// Loads the Mappls Vector Maps SDK the same way it's proven to work in the
// HS project (raw <script> tag + window.mappls), instead of going through
// the mappls-web-maps npm package's initialize() wrapper — that wrapper's
// auth-mode handling kept 401'ing with this Console key even with
// auth:'legacy' set, whereas this exact script URL is confirmed working in
// production for this same key.
//
// IMPORTANT: the static Maps SDK key (VITE_MAPPLS_API_KEY) only authenticates
// the base map_sdk (tile rendering). The map_sdk_plugins bundle (search,
// directions, etc.) requires a real OAuth access_token minted from a
// client_id/client_secret pair via Mappls' token endpoint — passing the
// static key there fails with "Plugin fail to load, need a valid token!".
// So for plugins we fetch a short-lived access_token from our own backend
// (which holds the client_id/secret and caches the token) instead.
import api from '../api/axios';

export const MAPPLS_KEY = import.meta.env.VITE_MAPPLS_API_KEY;

let mapLoadPromise = null;      // caches the base map_sdk load (this part is fine to cache forever)
let pluginsLoadPromise = null;  // caches ONLY a *successful* plugin load — failures are not cached, so the next search attempt retries and logs why

async function getPluginAccessToken() {
  const { data } = await api.get('/mappls/plugin-token');
  const token = data?.data?.accessToken;
  if (!token) throw new Error('Backend did not return an accessToken from /api/mappls/plugin-token');
  return token;
}

// Loads the search/plugins bundle. Does NOT cache failures — every call to
// loadMappls() while window.mappls.search is still missing will retry this
// and log the real reason to the console, so a misconfigured backend or an
// expired token surfaces immediately instead of silently staying broken for
// the rest of the page session.
function loadPluginsScript() {
  if (window.mappls && window.mappls.search) return Promise.resolve();
  if (pluginsLoadPromise) return pluginsLoadPromise;

  pluginsLoadPromise = getPluginAccessToken()
    .then((accessToken) => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://apis.mappls.com/advancedmaps/api/${accessToken}/map_sdk_plugins?v=3.0&libraries=search`;
      script.async = true;
      script.onload = () => {
        if (window.mappls && window.mappls.search) {
          resolve();
        } else {
          reject(new Error('map_sdk_plugins script loaded but window.mappls.search is still undefined'));
        }
      };
      script.onerror = () => reject(new Error('map_sdk_plugins <script> failed to load (network/CORS/invalid token)'));
      document.head.appendChild(script);
    }))
    .catch((err) => {
      console.error('[mapplsLoader] Search plugin failed to load — location search will be unavailable:', err.message);
      pluginsLoadPromise = null; // don't cache the failure — let the next attempt retry
      throw err;
    });

  return pluginsLoadPromise;
}

// Resolves once window.mappls (the base map) is ready to use. Safe to call
// from multiple components — the first call injects the script, everyone
// else just waits on (or immediately gets) the same promise. The plugins
// bundle is loaded best-effort alongside it: if it fails, the map itself
// still resolves fine, only search stays unavailable (and the console will
// say exactly why).
export function loadMappls() {
  if (!MAPPLS_KEY) {
    return Promise.reject(new Error('VITE_MAPPLS_API_KEY is not set'));
  }
  if (mapLoadPromise) {
    // Base map already loaded — best-effort (re)try plugins too, but never
    // let a plugin failure reject the overall promise.
    return mapLoadPromise.then((mappls) => loadPluginsScript().catch(() => {}).then(() => mappls));
  }

  const attachPlugins = (mappls) => loadPluginsScript().catch(() => {}).then(() => mappls);

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

  return mapLoadPromise.then(attachPlugins);
}