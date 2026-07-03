const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Duty = require('../models/Duty'); // populate ke liye register hona zaroori hai

const getMySummary = async (req, res) => {
  try {
    const page  = Number(req.query?.page  || 1);
    const limit = Number(req.query?.limit || 20);
    const skip  = (page - 1) * limit;
    const officerId = new mongoose.Types.ObjectId(req.user._id);
    const filter = { officerUserRef: officerId };

    const [records, total, statusCounts, faceVerified] = await Promise.all([
      Attendance.find(filter)
        .sort({ checkedInAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('dutyRef', 'dutyName locationName startDate endDate status'),
      Attendance.countDocuments(filter),
      Attendance.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Attendance.countDocuments({ ...filter, faceMatchPassed: true }),
    ]);

    const stats = {
      total,
      present: statusCounts.find((s) => s._id === 'present')?.count || 0,
      partial: statusCounts.find((s) => s._id === 'partial')?.count || 0,
      absent:  statusCounts.find((s) => s._id === 'absent')?.count  || 0,
      faceVerified,
    };

    return res.status(200).json({
      success: true,
      message: 'Attendance summary fetched',
      data: {
        records,
        stats,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
};

module.exports = { getMySummary };