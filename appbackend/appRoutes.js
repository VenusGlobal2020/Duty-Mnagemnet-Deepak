const express = require('express');
const router = express.Router();

const faceRoutes = require('./routes/faceRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const trackingRoutes = require('./routes/trackingRoutes');

router.use(faceRoutes);
router.use(attendanceRoutes);
router.use(trackingRoutes);

module.exports = router;

