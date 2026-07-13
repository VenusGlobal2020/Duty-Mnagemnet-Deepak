const express = require('express');
const router = express.Router();
const { getActiveEmergency } = require('../controllers/emergencyController');
const { protect } = require('../middleware/authMiddleware');

// Any authenticated role (officer/admin/operator/superadmin) — used to show
// the persistent lockdown banner and to warn on the leave-apply forms.
router.use(protect);
router.get('/active', getActiveEmergency);

module.exports = router;