const courseService = require('../services/courseService');
const lessonService = require('../services/lessonService');
const HttpError = require('../utils/httpError');
const { collectErrors } = require('../utils/validation');

function pickLessonFields(body) {
  return { title: body.title, content: body.content };
}

function coursePath(courseId) {
  return `/courses/${courseId}`;
}

async function show(req, res) {
  const course = await courseService.getVisibleCourse(req.user, req.params.courseId);
  const lesson = await lessonService.getLesson(course._id, req.params.lessonId);
  res.render('lessons/show', { title: lesson.title, course, lesson });
}

async function newForm(req, res) {
  const course = await lessonService.getEditableCourse(req.params.courseId);
  res.render('lessons/new', { title: 'New lesson', course, errors: {}, values: {} });
}

async function create(req, res) {
  const values = pickLessonFields(req.body);
  const errors = collectErrors(req);
  if (errors) {
    const course = await lessonService.getEditableCourse(req.params.courseId);
    return res.status(422).render('lessons/new', { title: 'New lesson', course, errors, values });
  }

  await lessonService.addLesson(req.user, req.params.courseId, values);
  req.flash('success', 'Lesson added.');
  res.redirect(coursePath(req.params.courseId));
}

async function editForm(req, res) {
  const course = await lessonService.getEditableCourse(req.params.courseId);
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
    const course = await lessonService.getEditableCourse(req.params.courseId);
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

module.exports = { show, newForm, create, editForm, update, remove, move };
