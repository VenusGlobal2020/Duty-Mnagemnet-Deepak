const User = require('../models/User');

// ─── Hierarchy-aware suspension check ────────────────────────────────────────
// A user's own `status` field is only part of the picture. Suspending a
// superadmin must also lock out every admin/operator/officer beneath them,
// and suspending an admin must lock out every operator/officer beneath that
// admin — WITHOUT having to bulk-update every descendant document (which
// would be slow, easy to get out of sync, and hard to reverse cleanly on
// re-activation). Instead we walk the hierarchy live, on every login and on
// every authenticated request (see middleware/authMiddleware.js), and treat
// the user as "effectively suspended" if the user OR any ancestor in their
// chain is suspended.
//
// Hierarchy:
//   officer             -> adminRef -> superadminRef
//   operator_* (both)   -> adminRef -> superadminRef
//   admin               -> superadminRef
//   superadmin / master -> (no parent)
//
// Returns { suspended: boolean, reason: string|null }
const getEffectiveSuspension = async (user) => {
  if (user.status === 'suspended') {
    return { suspended: true, reason: 'Your account has been suspended. Contact your administrator.' };
  }

  let adminId = null;
  let superadminId = null;

  if (user.role === 'admin') {
    superadminId = user.superadminRef;
  } else if (user.role === 'operator_special' || user.role === 'operator_regular' || user.role === 'officer') {
    adminId = user.adminRef;
  }

  if (adminId) {
    const admin = await User.findById(adminId).select('status superadminRef');
    if (!admin) return { suspended: false, reason: null };
    if (admin.status === 'suspended') {
      return { suspended: true, reason: "Access denied. Your admin's account has been suspended." };
    }
    superadminId = admin.superadminRef;
  }

  if (superadminId) {
    const superadmin = await User.findById(superadminId).select('status');
    if (superadmin?.status === 'suspended') {
      return { suspended: true, reason: 'Access denied. The superadmin above your hierarchy has been suspended.' };
    }
  }

  return { suspended: false, reason: null };
};

module.exports = { getEffectiveSuspension };