const express = require('express');
const router = express.Router();
const { getAdmins, getAdminDetails, getAllDuties, getDashboardStats } = require('../controllers/superadminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('superadmin'));

router.get('/dashboard', getDashboardStats);
router.get('/admins', getAdmins);
router.get('/admins/:adminId/details', getAdminDetails);
router.get('/duties', getAllDuties);

module.exports = router;
