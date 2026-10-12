const express = require('express');
const courseController = require('../controllers/courseController');
const lessonRoutes = require('./lessons');
const { requireAuth, requireRole } = require('../middleware/auth');
const { courseRules } = require('../validators/courseValidators');
const { ROLES } = require('../config/constants');

const router = express.Router();
const instructorOnly = requireRole(ROLES.INSTRUCTOR);

router.use(requireAuth);

router.get('/', courseController.index);
router.get('/new', instructorOnly, courseController.newForm);
router.post('/', instructorOnly, courseRules, courseController.create);
router.get('/:id', courseController.show);
router.get('/:id/edit', instructorOnly, courseController.editForm);
router.post('/:id/edit', instructorOnly, courseRules, courseController.update);
router.post('/:id/status', instructorOnly, courseController.changeStatus);

router.use('/:courseId/lessons', lessonRoutes);

module.exports = router;
