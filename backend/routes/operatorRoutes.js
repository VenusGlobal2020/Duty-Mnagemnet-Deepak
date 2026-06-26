const express = require('express');
const router = express.Router();
const {
  getOfficers, addOfficer, updateOfficer, deleteOfficer,
  createDuty, getDuties, getDutyById, updateDuty, cancelDuty,
  replaceOfficer, manualReplaceOfficer, getRankAvailability, getAvailableOfficersByRank,
  getDutiesForMap,
} = require('../controllers/operatorController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadDutyDoc } = require('../config/cloudinary');

router.use(protect, authorize('operator_special', 'operator_regular'));

// Officers
// NOTE: '/officers/available' must be declared before '/officers/:officerId'
// so Express doesn't treat "available" as an :officerId value.
router.get('/officers/available', getAvailableOfficersByRank);
router.route('/officers').get(getOfficers).post(addOfficer);
router.route('/officers/:officerId').put(updateOfficer).delete(deleteOfficer);

// Duties
// NOTE: '/duties/map' must be declared before '/duties/:dutyId' for the same reason.
router.route('/duties')
  .get(getDuties)
  .post(uploadDutyDoc.array('documents', 5), createDuty);
router.get('/duties/map', getDutiesForMap);
router.route('/duties/:dutyId').get(getDutyById).put(updateDuty);
router.patch('/duties/:dutyId/cancel', cancelDuty);
router.patch('/duties/:dutyId/replace/:assignmentId', replaceOfficer);
router.patch('/duties/:dutyId/assignments/:assignmentId/manual-replace', manualReplaceOfficer);

// Ranks
router.get('/ranks/availability', getRankAvailability);

module.exports = router;