const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { searchPlaces, geocodeAddress } = require('../controllers/mapplsController');

router.get('/search', protect, searchPlaces);
router.post('/geocode', protect, geocodeAddress);

module.exports = router;