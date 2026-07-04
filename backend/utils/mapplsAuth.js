const axios = require('axios');

// Mappls' map_sdk_plugins bundle (search, directions, etc.) requires a real
// OAuth access_token — the static Maps SDK key used for tile rendering is
// NOT accepted there ("Plugin fail to load, need a valid token!"). This
// mints one via client_credentials and caches it in memory until shortly
// before it expires (Mappls tokens are valid ~24h by default).
let cachedToken = null;
let expiresAt = 0;

const getMapplsAccessToken = async () => {
  if (cachedToken && Date.now() < expiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const { MAPPLS_CLIENT_ID, MAPPLS_CLIENT_SECRET } = process.env;
  if (!MAPPLS_CLIENT_ID || !MAPPLS_CLIENT_SECRET) {
    throw new Error('MAPPLS_CLIENT_ID / MAPPLS_CLIENT_SECRET is not configured in .env');
  }

  const { data } = await axios.post(
    'https://outpost.mappls.com/api/security/oauth/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: MAPPLS_CLIENT_ID,
      client_secret: MAPPLS_CLIENT_SECRET,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  if (!data?.access_token) {
    throw new Error('Mappls token endpoint did not return an access_token');
  }

  cachedToken = data.access_token;
  expiresAt = Date.now() + (Number(data.expires_in) || 86400) * 1000;
  return cachedToken;
};

module.exports = { getMapplsAccessToken };