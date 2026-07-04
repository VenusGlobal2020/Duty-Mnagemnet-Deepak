const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getPluginToken } = require('../controllers/mapplsController');

router.get('/plugin-token', protect, getPluginToken);

module.exports = router;