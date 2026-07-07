const express = require('express');
const router = express.Router();
const {
  createAdmin, getAdmins, getAdminDetails, getAdminQuota,
  suspendUser, activateUser,
  bulkUploadOfficers, getAllOfficers,
  getAllDuties, getDashboardStats, getOperatorsByAdmin, getDutiesForMap, getDutyById,
} = require('../controllers/superadminController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadOfficerExcel } = require('../config/cloudinary');

router.use(protect, authorize('superadmin'));

router.get('/dashboard', getDashboardStats);
router.get('/quota', getAdminQuota);

// Admin management — creation is capped by the quota the master granted.
router.route('/admins').post(createAdmin).get(getAdmins);
router.get('/admins/:adminId/details', getAdminDetails);
router.get('/admins/:adminId/operators', getOperatorsByAdmin);

// Suspend/activate any admin (and, by extension, its operators) or any
// individual operator under this superadmin's hierarchy.
router.patch('/suspend/:userId', suspendUser);
router.patch('/activate/:userId', activateUser);

// Bulk officer upload — same feature the master has, scoped to this
// superadmin's own admins.
router.post('/officers/bulk-upload', uploadOfficerExcel.single('file'), bulkUploadOfficers);
router.get('/officers', getAllOfficers);

router.get('/duties', getAllDuties);
router.get('/duties/map', getDutiesForMap);
router.get('/duties/:dutyId', getDutyById);

module.exports = router;