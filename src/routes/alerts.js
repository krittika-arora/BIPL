const express = require('express');
const alertController = require('../controllers/alertController');
const { requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Inactivity alerts are for instructors only; each sees alerts for the courses they own.
const router = express.Router();
router.use(requireRole(ROLES.INSTRUCTOR));

router.get('/', alertController.index);

module.exports = router;
