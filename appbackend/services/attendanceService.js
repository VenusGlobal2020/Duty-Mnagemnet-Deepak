const axios = require("axios");

// Strip any trailing slash AND any trailing "/api" so it doesn't matter
// how BACKEND_URL is set on the server — this is what caused
// "/api/api/attendance/checkin" (Not Found).
const RAW_BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const BACKEND_URL = RAW_BACKEND_URL.replace(/\/+$/, "").replace(/\/api$/, "");

async function checkIn(token, dutyId, lat, lng) {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/attendance/checkin`,
      { dutyId, lat, lng },
      { headers: { Authorization: token } }
    );
    return response.data;
  } catch (err) {
    if (err.response) throw new Error(err.response.data.message);
    throw err;
  }
}

module.exports = { checkIn };