const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { errorResponse } = require('../utils/response');

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

    // Check suspension chain
    if (user.status === 'suspended') {
      return errorResponse(res, 403, 'Your account has been suspended. Contact your administrator.');
    }

    // If admin - check superadmin is not suspended
    if (user.role === 'admin' && user.superadminRef) {
      const superadmin = await User.findById(user.superadminRef).select('status');
      if (superadmin?.status === 'suspended') {
        return errorResponse(res, 403, 'Access denied. Parent account is suspended.');
      }
    }

    // If operator - check admin hierarchy
    if ((user.role === 'operator_special' || user.role === 'operator_regular') && user.adminRef) {
      const admin = await User.findById(user.adminRef).select('status superadminRef');
      if (admin?.status === 'suspended') {
        return errorResponse(res, 403, 'Access denied. Parent account is suspended.');
      }
      if (admin?.superadminRef) {
        const superadmin = await User.findById(admin.superadminRef).select('status');
        if (superadmin?.status === 'suspended') {
          return errorResponse(res, 403, 'Access denied. Parent account is suspended.');
        }
      }
    }

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
