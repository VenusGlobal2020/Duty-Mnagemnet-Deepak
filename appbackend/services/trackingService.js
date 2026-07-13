const axios = require('axios');
const TrackLog = require('../models/TrackLog');
const { getDistanceMeters } = require('../utils/geo');

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:8000';
const FLASK_TIMEOUT_MS = 8000;

const isSanePoint = (p) =>
  p &&
  typeof p.lat === 'number' && p.lat >= -90 && p.lat <= 90 &&
  typeof p.lng === 'number' && p.lng >= -180 && p.lng <= 180 &&
  !Number.isNaN(new Date(p.recordedAt).getTime());

async function cleanPoints(points, previousLast) {
  const saneOnly = points.filter(isSanePoint);
  if (saneOnly.length === 0) return [];

  try {
    const res = await axios.post(
      `${FLASK_URL}/process-track`,
      { points: saneOnly, previousLast: previousLast || null },
      { timeout: FLASK_TIMEOUT_MS }
    );
    if (res.data && res.data.success && Array.isArray(res.data.cleanedPoints)) {
      return res.data.cleanedPoints;
    }
    return saneOnly;
  } catch (err) {
    console.warn('⚠️ Flask /process-track unreachable, using raw points:', err.message);
    return saneOnly;
  }
}

async function appendPoints({ attendanceId, dutyId, officerUserId, date, points }) {
  const existing = await TrackLog.findOne(
    { attendanceRef: attendanceId },
    { points: { $slice: -1 } }
  );

  const previousLast = existing?.points?.[0]
    ? { lat: existing.points[0].lat, lng: existing.points[0].lng, recordedAt: existing.points[0].recordedAt }
    : null;

  // GUARANTEE the stored array stays in strict chronological order, no
  // matter what order batches physically arrive at the server (network
  // retries/delays can and do reorder requests). Without this, an
  // out-of-order batch gets appended after a chronologically-later one
  // already in the array — each batch is internally sorted, but the full
  // array never is — and the route polyline zigzags between the two
  // batches when drawn. A point older than what's already stored is
  // simply dropped; losing one late point is far better than corrupting
  // the whole route.
  const points_ = previousLast
    ? points.filter((p) => p && !Number.isNaN(new Date(p.recordedAt).getTime()) && new Date(p.recordedAt) > new Date(previousLast.recordedAt))
    : points;

  const cleaned = await cleanPoints(points_, previousLast);
  if (cleaned.length === 0) {
    return {
       saved: 0, 
       skipped: points.length - cleaned.length,
        totalDistanceMeters: existing?.totalDistanceMeters || 0 };
  }

  cleaned.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

  let addedDistance = 0;
  let cursor = previousLast;
  for (const p of cleaned) {
    if (cursor) addedDistance += getDistanceMeters(cursor.lat, cursor.lng, p.lat, p.lng);
    cursor = p;
  }

  const firstTs = new Date(cleaned[0].recordedAt);
  const lastTs = new Date(cleaned[cleaned.length - 1].recordedAt);

  const updated = await TrackLog.findOneAndUpdate(
    { attendanceRef: attendanceId },
    {
      $setOnInsert: { dutyRef: dutyId, officerUserRef: officerUserId, date, firstPointAt: firstTs },
      $set: { lastPointAt: lastTs },
      $inc: { pointCount: cleaned.length, totalDistanceMeters: Math.round(addedDistance) },
      $push: {
        points: { $each: cleaned, $slice: -TrackLog.MAX_POINTS_PER_SHIFT },
      },
    },
    { upsert: true, new: true }
  );

  return {
    saved: cleaned.length,
    skipped: points.length - cleaned.length,
    totalDistanceMeters: updated.totalDistanceMeters,
    pointCount: updated.pointCount,
  };
}

async function getRouteForDay({ dutyId, officerUserId, date }) {
  return TrackLog.findOne({ dutyRef: dutyId, officerUserRef: officerUserId, date });
}

async function listRouteDays({ dutyId, officerUserId }) {
  return TrackLog.find(
    { dutyRef: dutyId, officerUserRef: officerUserId },
    { date: 1, pointCount: 1, totalDistanceMeters: 1, firstPointAt: 1, lastPointAt: 1 }
  ).sort({ date: -1 });
}

module.exports = { appendPoints, getRouteForDay, listRouteDays };