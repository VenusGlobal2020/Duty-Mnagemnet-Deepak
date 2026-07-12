const express = require('express');
const router = express.Router();
const {
  createSuperadmin, getSuperadmin, updateAdminCreationLimit,
  getAdmins, getAdminDetails,
  suspendUser, activateUser,
  createRank, getRanks, updateRank, deleteRank,
  bulkUploadOfficers, getAllOfficers, getOfficerLocations,
  getDutiesForMap,
} = require('../controllers/masterController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadOfficerExcel } = require('../config/cloudinary');

router.use(protect, authorize('master'));

router.route('/superadmin').post(createSuperadmin).get(getSuperadmin);
router.patch('/superadmin/admin-limit', updateAdminCreationLimit);

// Admin creation now belongs to the superadmin (see /api/superadmin/admins).
// Master retains read-only visibility with full info across every admin.
router.get('/admins', getAdmins);
router.get('/admins/:adminId/details', getAdminDetails);

// Master may only suspend/activate the superadmin — this cascades
// automatically to every admin/operator/officer beneath them.
router.patch('/suspend/:userId', suspendUser);
router.patch('/activate/:userId', activateUser);

router.route('/ranks').post(createRank).get(getRanks);
router.route('/ranks/:rankId').put(updateRank).delete(deleteRank);

router.post('/officers/bulk-upload', uploadOfficerExcel.single('file'), bulkUploadOfficers);
router.get('/officers/locations', getOfficerLocations);
router.get('/officers', getAllOfficers);

router.get('/duties/map', getDutiesForMap);

module.exports = router;