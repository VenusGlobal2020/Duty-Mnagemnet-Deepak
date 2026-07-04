const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getPluginToken, geocodeAddress } = require('../controllers/mapplsController');

router.get('/plugin-token', protect, getPluginToken);
router.post('/geocode', protect, geocodeAddress);

module.exports = router;