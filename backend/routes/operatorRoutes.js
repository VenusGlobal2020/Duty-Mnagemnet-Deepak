const express = require('express');
const router = express.Router();
const {
  getOfficers, addOfficer, updateOfficer, deleteOfficer, getOfficerLocations,
  createDuty, getDuties, getDutyById, updateDuty, cancelDuty, deleteDuty,
  replaceOfficer, manualReplaceOfficer, getRankAvailability, getAvailableOfficersByRank,
  getDutiesForMap, bulkCreateDuties,
  markOfficerAvailable, getPendingReturnOfficers, getLeaveConflictSuggestions, resolveLeaveConflict,
} = require('../controllers/operatorController');
const {
  createDutyType, getDutyTypes, updateDutyType, deleteDutyType,
} = require('../controllers/dutyTypeController');
const {
  getSwapRequests, getSwapHistoryForDuty, getSwapCandidates, acceptSwapRequest, rejectSwapRequest, forceSwap,
} = require('../controllers/swapController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadDutyDoc, uploadOfficerExcel } = require('../config/cloudinary');

router.use(protect, authorize('operator_special', 'operator_regular'));

// Officers
// NOTE: '/officers/available' and '/officers/pending-return' must be declared
// before '/officers/:officerId' so Express doesn't treat them as an :officerId value.
router.get('/officers/available', getAvailableOfficersByRank);
router.get('/officers/pending-return', getPendingReturnOfficers);
router.get('/officers/locations', getOfficerLocations);
router.route('/officers').get(getOfficers).post(addOfficer);
router.route('/officers/:officerId').put(updateOfficer).delete(deleteOfficer);
router.patch('/officers/:officerId/mark-available', markOfficerAvailable);

// Duty Types (regular operator only — enforced in the controller)
router.route('/duty-types').get(getDutyTypes).post(createDutyType);
router.route('/duty-types/:dutyTypeId').put(updateDutyType).delete(deleteDutyType);

// Duties
// NOTE: '/duties/map' and '/duties/bulk-upload' must be declared before
// '/duties/:dutyId' so Express doesn't treat them as a :dutyId value.
router.route('/duties')
  .get(getDuties)
  .post(uploadDutyDoc.array('documents', 5), createDuty);
router.get('/duties/map', getDutiesForMap);
router.post('/duties/bulk-upload', uploadOfficerExcel.single('file'), bulkCreateDuties);
router.route('/duties/:dutyId').get(getDutyById).put(updateDuty).delete(deleteDuty);
router.patch('/duties/:dutyId/cancel', cancelDuty);
router.patch('/duties/:dutyId/replace/:assignmentId', replaceOfficer);
router.patch('/duties/:dutyId/assignments/:assignmentId/manual-replace', manualReplaceOfficer);
router.get('/duties/:dutyId/assignments/:assignmentId/leave-conflict-suggestions', getLeaveConflictSuggestions);
router.patch('/duties/:dutyId/assignments/:assignmentId/resolve-leave-conflict', resolveLeaveConflict);

// Officer swaps
// NOTE: '/swaps' (the queue) must be declared before any param-based duty
// swap route to avoid ambiguity, though here they live under different
// prefixes so there's no actual collision — kept explicit for clarity.
router.get('/swaps', getSwapRequests);
router.patch('/swaps/:swapId/accept', acceptSwapRequest);
router.patch('/swaps/:swapId/reject', rejectSwapRequest);
router.get('/duties/:dutyId/swaps', getSwapHistoryForDuty);
router.get('/duties/:dutyId/assignments/:assignmentId/swap-candidates', getSwapCandidates);
router.post('/duties/:dutyId/assignments/:assignmentId/force-swap', forceSwap);

// Ranks
router.get('/ranks/availability', getRankAvailability);

module.exports = router;