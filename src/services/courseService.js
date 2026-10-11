const Course = require('../models/Course');
const activityService = require('./activityService');
const HttpError = require('../utils/httpError');
const { ROLES, COURSE_STATUS, ACTIVITY_ACTIONS } = require('../config/constants');

const EDITABLE_FIELDS = ['title', 'description', 'category'];

// Learners only ever see published courses; instructors see everything.
function visibilityFilter(user) {
  return user.role === ROLES.INSTRUCTOR ? {} : { status: COURSE_STATUS.PUBLISHED };
}

function listCourses(user) {
  return Course.find(visibilityFilter(user))
    .populate('instructor', 'name')
    .sort({ createdAt: -1 })
    .lean();
}

async function getVisibleCourse(user, courseId) {
  const course = await Course.findOne({ _id: courseId, ...visibilityFilter(user) })
    .populate('instructor', 'name email')
    .lean();
  if (!course) throw new HttpError(404, 'Course not found.');
  return course;
}

async function getCourseForEdit(courseId) {
  const course = await Course.findById(courseId);
  if (!course) throw new HttpError(404, 'Course not found.');
  return course;
}

// All course writes go through this service so every change lands in the activity log.
async function createCourse(actor, data) {
  const course = await Course.create({
    title: data.title,
    description: data.description,
    category: data.category,
    instructor: actor._id,
  });
  await activityService.record({
    course: course._id,
    actor: actor._id,
    action: ACTIVITY_ACTIONS.CREATED,
  });
  return course;
}

// Applies only the fields that actually changed and logs them as { field, from, to }.
async function updateCourse(actor, courseId, data) {
  const course = await getCourseForEdit(courseId);

  const changes = [];
  for (const field of EDITABLE_FIELDS) {
    if (data[field] !== undefined && data[field] !== course[field]) {
      changes.push({ field, from: course[field], to: data[field] });
      course[field] = data[field];
    }
  }

  if (changes.length) {
    await course.save();
    await activityService.record({
      course: course._id,
      actor: actor._id,
      action: ACTIVITY_ACTIONS.UPDATED,
      changes,
    });
  }
  return { course, changes };
}

module.exports = {
  listCourses,
  getVisibleCourse,
  getCourseForEdit,
  createCourse,
  updateCourse,
};
