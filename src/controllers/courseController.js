const courseService = require('../services/courseService');
const activityService = require('../services/activityService');
const { ROLES, COURSE_CATEGORIES } = require('../config/constants');
const { collectErrors } = require('../utils/validation');

function pickCourseFields(body) {
  return { title: body.title, description: body.description, category: body.category };
}

async function index(req, res) {
  const courses = await courseService.listCourses(req.user);
  res.render('courses/index', { title: 'Courses', courses });
}

async function show(req, res) {
  const course = await courseService.getVisibleCourse(req.user, req.params.id);
  const activity =
    req.user.role === ROLES.INSTRUCTOR ? await activityService.listForCourse(course._id) : [];
  res.render('courses/show', { title: course.title, course, activity });
}

function newForm(req, res) {
  res.render('courses/new', {
    title: 'New course',
    categories: COURSE_CATEGORIES,
    errors: {},
    values: {},
  });
}

async function create(req, res) {
  const values = pickCourseFields(req.body);
  const errors = collectErrors(req);
  if (errors) {
    return res.status(422).render('courses/new', {
      title: 'New course',
      categories: COURSE_CATEGORIES,
      errors,
      values,
    });
  }

  const course = await courseService.createCourse(req.user, values);
  req.flash('success', 'Course created as a draft.');
  res.redirect(`/courses/${course.id}`);
}

async function editForm(req, res) {
  const course = await courseService.getCourseForEdit(req.params.id);
  res.render('courses/edit', {
    title: `Edit ${course.title}`,
    course,
    categories: COURSE_CATEGORIES,
    errors: {},
    values: pickCourseFields(course),
  });
}

async function update(req, res) {
  const values = pickCourseFields(req.body);
  const errors = collectErrors(req);
  if (errors) {
    const course = await courseService.getCourseForEdit(req.params.id);
    return res.status(422).render('courses/edit', {
      title: `Edit ${course.title}`,
      course,
      categories: COURSE_CATEGORIES,
      errors,
      values,
    });
  }

  const { course, changes } = await courseService.updateCourse(req.user, req.params.id, values);
  req.flash(changes.length ? 'success' : 'info', changes.length ? 'Course updated.' : 'No changes to save.');
  res.redirect(`/courses/${course.id}`);
}

module.exports = { index, show, newForm, create, editForm, update };
