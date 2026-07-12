const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { errorResponse } = require('../utils/response');
const { getEffectiveSuspension } = require('../utils/hierarchyStatus');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'Not authorized, no token');
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return errorResponse(res, 401, 'User not found');

    // Check suspension chain — covers the user's own status AND every
    // ancestor above them (admin -> superadmin, operator/officer -> admin ->
    // superadmin), so a master suspending a superadmin (or a superadmin
    // suspending an admin) immediately locks out everyone beneath, even
    // mid-session, without needing to touch descendant documents.
    const { suspended, reason } = await getEffectiveSuspension(user);
    if (suspended) return errorResponse(res, 403, reason);

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return errorResponse(res, 401, 'Invalid token');
    if (error.name === 'TokenExpiredError') return errorResponse(res, 401, 'Token expired');
    return errorResponse(res, 500, 'Authentication error');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 403, `Access denied. Required role: ${roles.join(' or ')}`);
    }
    next();
  };
};

module.exports = { protect, authorize };