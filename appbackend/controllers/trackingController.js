const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
require('../models/Duty'); // registers the Duty schema
const trackingService = require('../services/trackingService');
const { getDateStr } = require('../utils/geo');

const MAX_POINTS_PER_REQUEST = 100;

const logTrack = async (req, res) => {
  try {
    const { dutyId, points } = req.body;

    if (!dutyId || !mongoose.isValidObjectId(dutyId)) {
      return res.status(400).json({ success: false, message: 'Valid dutyId is required' });
    }
    if (!Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ success: false, message: 'points array is required' });
    }
    if (points.length > MAX_POINTS_PER_REQUEST) {
      return res.status(400).json({ success: false, message: `Too many points in one batch (max ${MAX_POINTS_PER_REQUEST})` });
    }

    const officerUserId = req.user._id;
    const today = getDateStr();

    // Only accept points while officer is currently checked in (not checked out yet)
    const openAttendance = await Attendance.findOne({
      dutyRef: dutyId,
      officerUserRef: officerUserId,
      date: today,
      checkedInAt: { $exists: true, $ne: null },
      checkedOutAt: { $in: [null, undefined] },
    });

    if (!openAttendance) {
      return res.status(409).json({
        success: false,
        message: 'Tracking is only recorded while checked in. Check in to this duty first.',
      });
    }

    const result = await trackingService.appendPoints({ dutyId, officerUserId, points });

    return res.status(200).json({ success: true, message: 'Track points recorded', data: result });
  } catch (err) {
    console.error('logTrack error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
};

const getMyRoute = async (req, res) => {
  try {
    const { dutyId } = req.params;
    if (!mongoose.isValidObjectId(dutyId)) {
      return res.status(400).json({ success: false, message: 'Invalid dutyId' });
    }
    const date = req.query.date || getDateStr();

    const log = await trackingService.getRouteForDay({ dutyId, officerUserId: req.user._id, date });

    return res.status(200).json({
      success: true,
      message: 'Route fetched',
      data: {
        date,
        points: log?.points || [],
        pointCount: log?.pointCount || 0,
        totalDistanceMeters: log?.totalDistanceMeters || 0,
        firstPointAt: log?.firstPointAt || null,
        lastPointAt: log?.lastPointAt || null,
      },
    });
  } catch (err) {
    console.error('getMyRoute error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
};

const getMyRouteDays = async (req, res) => {
  try {
    const { dutyId } = req.params;
    if (!mongoose.isValidObjectId(dutyId)) {
      return res.status(400).json({ success: false, message: 'Invalid dutyId' });
    }

    const days = await trackingService.listRouteDays({ dutyId, officerUserId: req.user._id });

    return res.status(200).json({ success: true, message: 'Route days fetched', data: { days } });
  } catch (err) {
    console.error('getMyRouteDays error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
};

module.exports = { logTrack, getMyRoute, getMyRouteDays };