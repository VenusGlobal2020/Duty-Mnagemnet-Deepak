const express = require('express');
const router = express.Router();
const { getAdmins, getAdminDetails, getAllDuties, getDashboardStats, getOperatorsByAdmin, getDutiesForMap, getDutyById } = require('../controllers/superadminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('superadmin'));

router.get('/dashboard', getDashboardStats);
router.get('/admins', getAdmins);
router.get('/admins/:adminId/details', getAdminDetails);
router.get('/admins/:adminId/operators', getOperatorsByAdmin);
router.get('/duties', getAllDuties);
router.get('/duties/map', getDutiesForMap);
router.get('/duties/:dutyId', getDutyById);

module.exports = router;