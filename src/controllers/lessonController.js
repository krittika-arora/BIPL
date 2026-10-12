const courseService = require('../services/courseService');
const lessonService = require('../services/lessonService');
const enrollmentService = require('../services/enrollmentService');
const progressService = require('../services/progressService');
const HttpError = require('../utils/httpError');
const { ROLES, PROGRESS_STATUS } = require('../config/constants');
const { collectErrors } = require('../utils/validation');

function pickLessonFields(body) {
  return { title: body.title, content: body.content };
}

function coursePath(courseId) {
  return `/courses/${courseId}`;
}

// Instructors can open any lesson; learners only lessons of a course they are enrolled in.
async function show(req, res) {
  const course = await courseService.getVisibleCourse(req.user, req.params.courseId);
  let enrollment = null;
  if (req.user.role === ROLES.LEARNER) {
    enrollment = await enrollmentService.findEnrollment(req.user._id, course._id).lean();
    if (!enrollment) {
      req.flash('info', 'Enrol in this course to open its lessons.');
      return res.redirect(coursePath(course._id));
    }
  }
  const lesson = await lessonService.getLesson(course._id, req.params.lessonId);
  const { previous, next } = await lessonService.getNeighbours(course._id, lesson.position);
  res.render('lessons/show', { title: lesson.title, course, lesson, enrollment, previous, next });
}

// Marks the lesson complete for the signed-in learner, then moves them on to the next lesson.
async function complete(req, res) {
  const { courseId, lessonId } = req.params;
  try {
    const { lesson, enrollment } = await progressService.completeLesson(req.user, courseId, lessonId);
    if (enrollment.status === PROGRESS_STATUS.COMPLETED) {
      req.flash('success', 'Course completed. Well done!');
      return res.redirect(coursePath(courseId));
    }
    const { next } = await lessonService.getNeighbours(courseId, lesson.position);
    req.flash('success', 'Lesson marked as complete.');
    return res.redirect(next ? `${coursePath(courseId)}/lessons/${next._id}` : coursePath(courseId));
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('warning', err.message);
    return res.redirect(coursePath(courseId));
  }
}

async function newForm(req, res) {
  const course = await lessonService.getEditableCourse(req.params.courseId, req.user);
  res.render('lessons/new', { title: 'New lesson', course, errors: {}, values: {} });
}

async function create(req, res) {
  const values = pickLessonFields(req.body);
  const errors = collectErrors(req);
  if (errors) {
    const course = await lessonService.getEditableCourse(req.params.courseId, req.user);
    return res.status(422).render('lessons/new', { title: 'New lesson', course, errors, values });
  }

  await lessonService.addLesson(req.user, req.params.courseId, values);
  req.flash('success', 'Lesson added.');
  res.redirect(coursePath(req.params.courseId));
}

async function editForm(req, res) {
  const course = await lessonService.getEditableCourse(req.params.courseId, req.user);
  const lesson = await lessonService.getLesson(course._id, req.params.lessonId);
  res.render('lessons/edit', {
    title: `Edit ${lesson.title}`,
    course,
    lesson,
    errors: {},
    values: pickLessonFields(lesson),
  });
}

async function update(req, res) {
  const values = pickLessonFields(req.body);
  const errors = collectErrors(req);
  if (errors) {
    const course = await lessonService.getEditableCourse(req.params.courseId, req.user);
    const lesson = await lessonService.getLesson(course._id, req.params.lessonId);
    return res.status(422).render('lessons/edit', {
      title: `Edit ${lesson.title}`,
      course,
      lesson,
      errors,
      values,
    });
  }

  const { changes } = await lessonService.updateLesson(
    req.user,
    req.params.courseId,
    req.params.lessonId,
    values,
  );
  req.flash(changes.length ? 'success' : 'info', changes.length ? 'Lesson updated.' : 'No changes to save.');
  res.redirect(coursePath(req.params.courseId));
}

async function remove(req, res) {
  try {
    const { lesson } = await lessonService.removeLesson(req.user, req.params.courseId, req.params.lessonId);
    req.flash('success', `Lesson "${lesson.title}" removed.`);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('danger', err.message);
  }
  res.redirect(coursePath(req.params.courseId));
}

async function move(req, res) {
  try {
    await lessonService.moveLesson(req.user, req.params.courseId, req.params.lessonId, req.body.direction);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('warning', err.message);
  }
  res.redirect(coursePath(req.params.courseId));
}

module.exports = { show, complete, newForm, create, editForm, update, remove, move };
