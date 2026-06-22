const express = require('express');
const router = express.Router();
const { createOperator, getOperators, updateOperator, getDuties, getDashboardStats } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.route('/operators').post(createOperator).get(getOperators);
router.put('/operators/:operatorId', updateOperator);
router.get('/duties', getDuties);

module.exports = router;
