const { protect } = require('../middleware/authMiddleware');

const express = require('express');
const router = express.Router();

const { registerFace, checkInImage, getFaceStatus } = require('../controllers/faceController');

// Register face descriptor (sent from React Native)
router.post(
    '/face/register',
    protect,
    registerFace
);

router.post(
    '/face/checkin-image',
    protect,
    checkInImage
);

router.post(
    '/face/checkin',
    protect,
    checkInImage
);

router.get('/face/status', protect, getFaceStatus);


module.exports = router;

