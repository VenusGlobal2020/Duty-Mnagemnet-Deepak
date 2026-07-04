const axios = require('axios');
const { getMapplsAccessToken } = require('../utils/mapplsAuth');
const { successResponse, errorResponse } = require('../utils/response');

// GET /api/mappls/plugin-token
// Returns a short-lived Mappls OAuth access_token for the frontend to load
// the map_sdk_plugins bundle (search, etc.) with. The client_id/secret never
// leave the server.
const getPluginToken = async (req, res) => {
  try {
    const accessToken = await getMapplsAccessToken();
    return successResponse(res, 200, 'Mappls token fetched', { accessToken });
  } catch (error) {
    return errorResponse(res, 500, error.message || 'Failed to fetch Mappls token');
  }
};

// Tries Mappls' Address Verification API first (works if it's ever enabled
// for this project). Falls back to OpenStreetMap's free Nominatim geocoder,
// which needs no key — used only to resolve address text → lat/lng; Mappls
// is still what renders the map and powers the search suggestions
// themselves, this just fills the one gap this Mappls account doesn't
// expose without a paid/business agreement (see comment below).
const geocodeViaMappls = async (address, refLat, refLng) => {
  const accessToken = await getMapplsAccessToken();
  const { data } = await axios.post(
    'https://atlas.mappls.com/api/places/address-verification',
    { inputAddress: address, latitude: refLat, longitude: refLng, includeDetails: true },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
  const geo = data?.geocodingResponse;
  if (!geo || !Number.isFinite(Number(geo.latitude)) || !Number.isFinite(Number(geo.longitude))) {
    throw new Error('Mappls returned no usable coordinates');
  }
  return { lat: Number(geo.latitude), lng: Number(geo.longitude), formattedAddress: geo.formattedAddress || address, source: 'mappls' };
};

const geocodeOnceViaNominatim = async (query, restrictToIndia) => {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: query,
      format: 'json',
      limit: 1,
      addressdetails: 1,
      ...(restrictToIndia ? { countrycodes: 'in' } : {}),
    },
    headers: {
      'User-Agent': 'DutyOps-LocationPicker/1.0 (internal duty management tool)',
      'Accept-Language': 'en',
    },
  });
  return data?.[0] || null;
};

// Full POI-style addresses (e.g. "5 Elgin Road, Civil Line, Prayagraj, Uttar
// Pradesh, 211001") are often too specific for OSM's database to have an
// exact match for, even though the locality/city portion almost always
// exists. So this tries the full string first, then progressively drops the
// leading (most specific) comma-separated segment and retries, down to a
// minimum of 2 segments (so we don't end up geocoding just "211001").
const geocodeViaNominatim = async (address) => {
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean);
  const attempts = [address];
  for (let drop = 1; segments.length - drop >= 2; drop++) {
    attempts.push(segments.slice(drop).join(', '));
  }

  for (const restrictToIndia of [true, false]) {
    for (const query of attempts) {
      try {
        const hit = await geocodeOnceViaNominatim(query, restrictToIndia);
        if (hit) {
          console.log(`[mapplsController] Nominatim matched on query: "${query}" (India-restricted: ${restrictToIndia})`);
          return { lat: Number(hit.lat), lng: Number(hit.lon), formattedAddress: hit.display_name || address, source: 'nominatim' };
        }
      } catch (err) {
        console.warn(`[mapplsController] Nominatim request failed for "${query}":`, err.message);
      }
    }
  }
  throw new Error(`Nominatim found no match for any variant of: ${address}`);
};

// POST /api/mappls/geocode  { address, lat?, lng? }
// See geocodeViaMappls/geocodeViaNominatim above — this account's Mappls
// plan only exposes eLoc (place-id) for search/geocode/getPinDetails, not
// raw coordinates (that's a Mappls "premium"/business-agreement feature per
// their own docs: "PREMIUM APIs/Parameters are not available for evaluation
// on signup. To get access, please contact API Support."). So Mappls is
// tried first (in case it's ever enabled), then Nominatim as a working
// fallback today.
const geocodeAddress = async (req, res) => {
  try {
    const { address, lat, lng } = req.body || {};
    if (!address || typeof address !== 'string' || !address.trim()) {
      return errorResponse(res, 400, 'address is required');
    }
    const trimmed = address.trim();
    const refLat = Number.isFinite(Number(lat)) ? Number(lat) : 22.3511148;
    const refLng = Number.isFinite(Number(lng)) ? Number(lng) : 78.6677428;

    try {
      const result = await geocodeViaMappls(trimmed, refLat, refLng);
      return successResponse(res, 200, 'Geocoded', result);
    } catch (mapplsErr) {
      console.warn('[mapplsController] Mappls geocode unavailable, falling back to Nominatim:', mapplsErr.response?.data || mapplsErr.message);
    }

    const result = await geocodeViaNominatim(trimmed);
    return successResponse(res, 200, 'Geocoded (fallback)', result);
  } catch (error) {
    console.error('[mapplsController] geocodeAddress failed on all providers:', error.response?.data || error.message);
    return errorResponse(res, 404, 'Could not geocode this address');
  }
};

module.exports = { getPluginToken, geocodeAddress };