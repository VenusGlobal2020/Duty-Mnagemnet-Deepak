const User = require('../models/User');
const Officer = require('../models/Officer');
const EmergencyPeriod = require('../models/EmergencyPeriod');

/**
 * Every admin/operator/officer User _id under a superadmin — i.e. everyone
 * an Emergency Lockdown declaration or resolution needs to be broadcast to.
 * (The superadmin themself is excluded — they're the one declaring it.)
 */
const getAllUserIdsUnderSuperadmin = async (superadminRef) => {
  const admins = await User.find({ superadminRef, role: 'admin' }).select('_id');
  const adminIds = admins.map((a) => a._id);
  const others = adminIds.length
    ? await User.find({
        adminRef: { $in: adminIds },
        role: { $in: ['operator_special', 'operator_regular', 'officer'] },
      }).select('_id')
    : [];
  return [...adminIds, ...others.map((u) => u._id)];
};

/**
 * Which superadmin's hierarchy a given User belongs to, regardless of role —
 * used to find "the emergency period relevant to me" from any role's dashboard.
 * Returns null for 'master' (not scoped under any single superadmin).
 */
const resolveSuperadminIdForUser = async (user) => {
  if (user.role === 'superadmin') return user._id;
  if (user.role === 'admin') return user.superadminRef || null;
  if (user.role === 'operator_special' || user.role === 'operator_regular') {
    if (!user.adminRef) return null;
    const admin = await User.findById(user.adminRef).select('superadminRef');
    return admin?.superadminRef || null;
  }
  if (user.role === 'officer') {
    const officer = await Officer.findOne({ userRef: user._id }).select('superadminRef');
    return officer?.superadminRef || null;
  }
  return null;
};

/**
 * The active Emergency Lockdown (if any) for a superadmin's hierarchy that
 * overlaps [fromDate, toDate] — consumed by leaveController.requestLeave to
 * force-route a new request straight to the superadmin instead of its
 * normal Inspector/DSP/Admin approver.
 */
const getActiveEmergencyPeriod = async (superadminRef, fromDate, toDate) => {
  if (!superadminRef) return null;
  return EmergencyPeriod.findOne({
    superadminRef,
    status: 'active',
    startDate: { $lte: toDate },
    endDate: { $gte: fromDate },
  });
};

module.exports = { getAllUserIdsUnderSuperadmin, resolveSuperadminIdForUser, getActiveEmergencyPeriod };