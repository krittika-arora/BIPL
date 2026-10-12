const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const enrollmentController = require('../controllers/enrollmentController');
const { ROLES } = require('../config/constants');
const authRoutes = require('./auth');
const courseRoutes = require('./courses');

const router = express.Router();

router.use(authRoutes);

router.get('/', requireAuth, (req, res) => {
  res.render('home', { title: 'Home' });
});

router.get('/my-learning', requireRole(ROLES.LEARNER), enrollmentController.myLearning);
router.use('/courses', courseRoutes);

module.exports = router;
