const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// The lists behind the dashboard's headline numbers. Learner details are for instructors only.
const router = express.Router();
router.use(requireRole(ROLES.INSTRUCTOR));

router.get('/learners', dashboardController.learners);
router.get('/completions', dashboardController.completions);
router.get('/in-progress', dashboardController.inProgress);

module.exports = router;
