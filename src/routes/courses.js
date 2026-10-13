const express = require('express');
const courseController = require('../controllers/courseController');
const enrollmentController = require('../controllers/enrollmentController');
const commentController = require('../controllers/commentController');
const lessonRoutes = require('./lessons');
const { requireAuth, requireRole } = require('../middleware/auth');
const { optionalListFile } = require('../middleware/upload');
const { verifyCsrf } = require('../middleware/csrf');
const { courseRules } = require('../validators/courseValidators');
const { enrolByEmailRules } = require('../validators/enrollmentValidators');
const { commentRules } = require('../validators/commentValidators');
const { ROLES } = require('../config/constants');

const router = express.Router();
const instructorOnly = requireRole(ROLES.INSTRUCTOR);
const learnerOnly = requireRole(ROLES.LEARNER);

// Public: the catalogue and course pages (published courses only for visitors and learners).
// Everything else needs a signed-in user; requireRole sends visitors to the login page.
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
// Both roles; who may comment on which course is decided in activityService.addComment.
router.post('/:id/comments', requireAuth, commentRules, commentController.create);
router.post(
  '/:id/enrollments/bulk',
  instructorOnly,
  optionalListFile('file'),
  verifyCsrf, // multipart: checked once the form fields are parsed
  enrollmentController.bulkEnrol,
);

// Lesson content is never public.
router.use('/:courseId/lessons', requireAuth, lessonRoutes);

module.exports = router;
