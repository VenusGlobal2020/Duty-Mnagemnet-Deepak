const express = require('express');
const router = express.Router();
const {
  createSuperadmin, getSuperadmin,
  createAdmin, getAdmins, getAdminDetails,
  suspendUser, activateUser,
  createRank, getRanks, updateRank, deleteRank,
  bulkUploadOfficers, getAllOfficers,
  getDutiesForMap,
} = require('../controllers/masterController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadOfficerExcel } = require('../config/cloudinary');

router.use(protect, authorize('master'));

router.route('/superadmin').post(createSuperadmin).get(getSuperadmin);
router.route('/admins').post(createAdmin).get(getAdmins);
router.get('/admins/:adminId/details', getAdminDetails);
router.patch('/suspend/:userId', suspendUser);
router.patch('/activate/:userId', activateUser);

router.route('/ranks').post(createRank).get(getRanks);
router.route('/ranks/:rankId').put(updateRank).delete(deleteRank);

router.post('/officers/bulk-upload', uploadOfficerExcel.single('file'), bulkUploadOfficers);
router.get('/officers', getAllOfficers);

router.get('/duties/map', getDutiesForMap);

module.exports = router;
