const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { getMySummary } = require('../controllers/attendanceController');

router.get('/attendance/summary', protect, getMySummary);

module.exports = router;