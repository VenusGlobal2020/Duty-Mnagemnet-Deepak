const axios = require('axios');
const { successResponse, errorResponse } = require('../utils/response');

// GET /api/mappls/search?query=...&lat=&lng=
// Hits Mappls' Autosuggest REST API directly with the static key (the same
// "REST / Map SDK Key" from the Console, set as MAPPLS_REST_KEY in .env) —
// no OAuth client_id/secret needed for this one. This is what actually has
// Mappls' rich POI database (shops, landmarks, etc.), and is what the old
// window.mappls.search() plugin was calling under the hood anyway — this
// just calls it straight from the backend, so the frontend no longer needs
// to load the OAuth-gated map_sdk_plugins bundle at all.
//
// IMPORTANT: like every other search/geocode product on this account's
// plan, the response only carries an eLoc (place-id) — never raw lat/lng
// (that's a Mappls "premium" feature). So after the person picks a result,
// the frontend calls POST /api/mappls/geocode with that result's address
// text to resolve real coordinates.
const searchPlaces = async (req, res) => {
  try {
    const { query, lat, lng } = req.query || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return errorResponse(res, 400, 'query is required');
    }

    const restKey = process.env.MAPPLS_REST_KEY;
    if (!restKey) {
      return errorResponse(res, 500, 'MAPPLS_REST_KEY is not configured in .env');
    }

    const params = {
      query: query.trim(),
      region: 'IND',
      access_token: restKey,
    };
    const refLat = Number(lat);
    const refLng = Number(lng);
    if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
      // "STRONGLY RECOMMENDED" by Mappls' own docs for accurate,
      // location-biased results.
      params.location = `${refLat},${refLng}`;
    }

    const { data } = await axios.get('https://search.mappls.com/search/places/autosuggest/json', { params });
    const results = (data?.suggestedLocations || []).map((item) => ({
      eLoc: item.eLoc,
      type: item.type,
      placeName: item.placeName,
      placeAddress: item.placeAddress,
      distance: item.distance,
    }));

    return successResponse(res, 200, 'Mappls search results', { results });
  } catch (error) {
    console.error('[mapplsController] searchPlaces failed:', error.response?.data || error.message);
    return errorResponse(res, 502, 'Mappls search failed');
  }
};

// Uses Mappls' Location Verification API — this is a DIFFERENT product from
// the OAuth-gated atlas.mappls.com address-verification endpoint (which
// needs a paid business agreement and was returning "Api Access Denied" /
// 401 on this account). This one authenticates with the same static
// MAPPLS_REST_KEY as searchPlaces above, and its whole job is: given an
// address + a rough reference lat/lng, it geocodes the address AND
// reverse-geocodes the reference point, then cross-checks them — so its
// `geocodingResponse.latitude/longitude` is a real, usable coordinate for
// the address text itself, independent of the reference point supplied.
const geocodeViaMappls = async (address, refLat, refLng) => {
  const restKey = process.env.MAPPLS_REST_KEY;
  if (!restKey) {
    throw new Error('MAPPLS_REST_KEY is not configured in .env');
  }
  const { data } = await axios.post(
    'https://search.mappls.com/search/address/address-verification',
    { inputAddress: address, latitude: refLat, longitude: refLng, includeDetails: true },
    { params: { access_token: restKey }, headers: { 'Content-Type': 'application/json' } }
  );
  const geo = data?.geocodingResponse;
  if (!geo || !Number.isFinite(Number(geo.latitude)) || !Number.isFinite(Number(geo.longitude))) {
    throw new Error('Mappls returned no usable coordinates');
  }
  return { lat: Number(geo.latitude), lng: Number(geo.longitude), formattedAddress: geo.formattedAddress || address, source: 'mappls' };
};

// Great-circle distance in km — used to pick the closest of several
// same-named Nominatim candidates to the search's reference point (e.g. two
// "Civil Lines" in different states shouldn't be treated as equally likely).
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const geocodeOnceViaNominatim = async (query, restrictToIndia, refLat, refLng, radiusKm, bounded) => {
  const hasRef = Number.isFinite(refLat) && Number.isFinite(refLng);
  const params = {
    q: query,
    format: 'json',
    limit: hasRef ? 5 : 1, // fetch a few candidates so we can pick the one nearest the reference point
    addressdetails: 1,
    ...(restrictToIndia ? { countrycodes: 'in' } : {}),
  };
  if (hasRef && radiusKm) {
    // 1 degree latitude ≈ 111km; longitude degrees shrink by cos(latitude).
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((refLat * Math.PI) / 180) || 1);
    params.viewbox = `${refLng - dLng},${refLat + dLat},${refLng + dLng},${refLat - dLat}`;
    // bounded=1 makes this a HARD filter — Nominatim will only return
    // results actually inside the box, instead of just "preferring" them
    // (bounded=0 lets a strong text match from a totally different city
    // win anyway, which is exactly what caused the wrong "New Delhi" match).
    params.bounded = bounded ? 1 : 0;
  }

  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params,
    headers: {
      'User-Agent': 'DutyOps-LocationPicker/1.0 (internal duty management tool)',
      'Accept-Language': 'en',
    },
  });
  if (!Array.isArray(data) || !data.length) return null;
  if (!hasRef || data.length === 1) return data[0];

  // Multiple candidates + we have a reference point — pick the closest one
  // instead of blindly trusting Nominatim's default (relevance-only) order.
  return data.reduce((closest, candidate) => {
    const d = haversineKm(refLat, refLng, Number(candidate.lat), Number(candidate.lon));
    return d < closest.__dist ? Object.assign(candidate, { __dist: d }) : closest;
  }, Object.assign(data[0], { __dist: haversineKm(refLat, refLng, Number(data[0].lat), Number(data[0].lon)) }));
};

// Growing search radii (km) tried around the reference point, hard-bounded
// (bounded=1) — each one is exhausted across every address-segment attempt
// before widening, so a nearby weak match always wins over a strong text
// match from somewhere far away.
const NOMINATIM_RADII_KM = [15, 50, 150, 400];

// Full POI-style addresses (e.g. "5 Elgin Road, Civil Line, Prayagraj, Uttar
// Pradesh, 211001") are often too specific for OSM's database to have an
// exact match for, even though the locality/city portion almost always
// exists. So this tries the full string first, then progressively drops the
// leading (most specific) comma-separated segment and retries, down to a
// minimum of 2 segments (so we don't end up geocoding just "211001").
//
// When a reference lat/lng is available (the map's current center), every
// one of those address attempts is first tried inside a hard geographic box
// around that point — starting small (15km) and widening step by step —
// before ever considering a result outside it. Only if NOTHING matches
// anywhere near the reference point does this fall back to an unbounded,
// India-wide (then global) search as a last resort. This is what stops a
// search near Mirzapur/Prayagraj from silently resolving to a same-named
// street clear across the country in Delhi.
const geocodeViaNominatim = async (address, refLat, refLng) => {
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean);
  const attempts = [address];
  for (let drop = 1; segments.length - drop >= 2; drop++) {
    attempts.push(segments.slice(drop).join(', '));
  }

  const hasRef = Number.isFinite(refLat) && Number.isFinite(refLng);

  if (hasRef) {
    for (const radiusKm of NOMINATIM_RADII_KM) {
      for (const query of attempts) {
        try {
          const hit = await geocodeOnceViaNominatim(query, true, refLat, refLng, radiusKm, true);
          if (hit) {
            console.log(`[mapplsController] Nominatim matched on query: "${query}" (within ${radiusKm}km)`);
            return { lat: Number(hit.lat), lng: Number(hit.lon), formattedAddress: hit.display_name || address, source: 'nominatim' };
          }
        } catch (err) {
          console.warn(`[mapplsController] Nominatim request failed for "${query}" (${radiusKm}km):`, err.message);
        }
      }
    }
  }

  // Last resort — nothing matched anywhere near the reference point (or we
  // never had one). Still soft-biased if hasRef, but no longer hard-bounded.
  for (const restrictToIndia of [true, false]) {
    for (const query of attempts) {
      try {
        const hit = await geocodeOnceViaNominatim(query, restrictToIndia, refLat, refLng, hasRef ? 400 : null, false);
        if (hit) {
          console.log(`[mapplsController] Nominatim matched on query: "${query}" (unbounded fallback, India-restricted: ${restrictToIndia})`);
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
// Tries Mappls' static-key Location Verification API first (real
// coordinates, and it's Mappls' own data — better precision/coverage than
// Nominatim for Indian addresses/POIs). Falls back to OpenStreetMap's free
// Nominatim geocoder only if that ever fails (rate limit, address it can't
// verify, etc).
const geocodeAddress = async (req, res) => {
  try {
    const { address, lat, lng } = req.body || {};
    if (!address || typeof address !== 'string' || !address.trim()) {
      return errorResponse(res, 400, 'address is required');
    }
    const trimmed = address.trim();
    // Used for the Mappls Location Verification call, which requires *some*
    // reference point — India-center is a harmless default there since that
    // call's result is the address's own geocoded coordinate, not something
    // derived from this reference.
    const refLat = Number.isFinite(Number(lat)) ? Number(lat) : 22.3511148;
    const refLng = Number.isFinite(Number(lng)) ? Number(lng) : 78.6677428;
    // For Nominatim's location *bias*, only use a real caller-supplied point
    // — biasing every unspecified search toward the arbitrary India-center
    // default would actively hurt results for addresses far from there.
    const biasLat = Number.isFinite(Number(lat)) ? Number(lat) : undefined;
    const biasLng = Number.isFinite(Number(lng)) ? Number(lng) : undefined;

    try {
      const result = await geocodeViaMappls(trimmed, refLat, refLng);
      return successResponse(res, 200, 'Geocoded', result);
    } catch (mapplsErr) {
      console.warn('[mapplsController] Mappls geocode unavailable, falling back to Nominatim:', mapplsErr.response?.data || mapplsErr.message);
    }

    const result = await geocodeViaNominatim(trimmed, biasLat, biasLng);
    return successResponse(res, 200, 'Geocoded (fallback)', result);
  } catch (error) {
    console.error('[mapplsController] geocodeAddress failed on all providers:', error.response?.data || error.message);
    return errorResponse(res, 404, 'Could not geocode this address');
  }
};

module.exports = { searchPlaces, geocodeAddress };