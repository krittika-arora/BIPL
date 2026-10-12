const express = require('express');
const { requireRole } = require('../middleware/auth');
const enrollmentController = require('../controllers/enrollmentController');
const homeController = require('../controllers/homeController');
const { ROLES } = require('../config/constants');
const authRoutes = require('./auth');
const courseRoutes = require('./courses');

const router = express.Router();

router.use(authRoutes);

// Public: visitors get the landing page, signed-in users their own home.
router.get('/', homeController.index);

router.get('/my-learning', requireRole(ROLES.LEARNER), enrollmentController.myLearning);
router.use('/courses', courseRoutes);

module.exports = router;
