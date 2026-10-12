const express = require('express');
const lessonController = require('../controllers/lessonController');
const { requireRole } = require('../middleware/auth');
const { lessonRules } = require('../validators/lessonValidators');
const { ROLES } = require('../config/constants');

// Mounted under /courses/:courseId/lessons; authentication is applied by the parent router.
const router = express.Router({ mergeParams: true });
const instructorOnly = requireRole(ROLES.INSTRUCTOR);

router.get('/new', instructorOnly, lessonController.newForm);
router.post('/', instructorOnly, lessonRules, lessonController.create);
router.get('/:lessonId', lessonController.show);
router.get('/:lessonId/edit', instructorOnly, lessonController.editForm);
router.post('/:lessonId/edit', instructorOnly, lessonRules, lessonController.update);
router.post('/:lessonId/delete', instructorOnly, lessonController.remove);

module.exports = router;
