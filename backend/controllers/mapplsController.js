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

module.exports = { getPluginToken };