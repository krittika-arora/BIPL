const express = require('express');
const courseController = require('../controllers/courseController');
const enrollmentController = require('../controllers/enrollmentController');
const lessonRoutes = require('./lessons');
const { requireAuth, requireRole } = require('../middleware/auth');
const { optionalListFile } = require('../middleware/upload');
const { courseRules } = require('../validators/courseValidators');
const { enrolByEmailRules } = require('../validators/enrollmentValidators');
const { ROLES } = require('../config/constants');

const router = express.Router();
const instructorOnly = requireRole(ROLES.INSTRUCTOR);
const learnerOnly = requireRole(ROLES.LEARNER);

router.use(requireAuth);

router.get('/', courseController.index);
router.get('/new', instructorOnly, courseController.newForm);
router.post('/', instructorOnly, courseRules, courseController.create);
router.get('/:id', courseController.show);
router.get('/:id/edit', instructorOnly, courseController.editForm);
router.post('/:id/edit', instructorOnly, courseRules, courseController.update);
router.post('/:id/status', instructorOnly, courseController.changeStatus);
router.post('/:id/enroll', learnerOnly, enrollmentController.enrolSelf);
router.post(
  '/:id/enrollments',
  instructorOnly,
  enrolByEmailRules,
  enrollmentController.enrolByEmail,
);
router.get('/:id/enrollments/bulk', instructorOnly, enrollmentController.bulkForm);
router.get('/:id/progress.csv', instructorOnly, enrollmentController.exportProgress);
router.post(
  '/:id/enrollments/bulk',
  instructorOnly,
  optionalListFile('file'),
  enrollmentController.bulkEnrol,
);

router.use('/:courseId/lessons', lessonRoutes);

module.exports = router;
