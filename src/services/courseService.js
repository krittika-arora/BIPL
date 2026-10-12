const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const activityService = require('./activityService');
const HttpError = require('../utils/httpError');
const {
  ROLES,
  COURSE_STATUS,
  COURSE_TRANSITIONS,
  ACTIVITY_ACTIONS,
} = require('../config/constants');

const EDITABLE_FIELDS = ['title', 'description', 'category'];

// How each legal transition is named in the activity log.
const TRANSITION_ACTIONS = {
  draft: { published: ACTIVITY_ACTIONS.PUBLISHED },
  published: { archived: ACTIVITY_ACTIONS.ARCHIVED },
  archived: { published: ACTIVITY_ACTIONS.RESTORED },
};

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

// The single entry point for course status changes: draft -> published -> archived, and restore.
async function transitionCourse(actor, courseId, toStatus) {
  const course = await getCourseForEdit(courseId);
  const from = course.status;

  if (!Object.values(COURSE_STATUS).includes(toStatus)) {
    throw HttpError.ruleViolation(`"${toStatus}" is not a course status.`);
  }
  if (!COURSE_TRANSITIONS[from].includes(toStatus)) {
    const allowed = COURSE_TRANSITIONS[from].join(' or ');
    throw HttpError.ruleViolation(
      `This ${from} course cannot be moved to ${toStatus}. It can only be moved to ${allowed}.`,
    );
  }
  if (toStatus === COURSE_STATUS.PUBLISHED) {
    const lessonCount = await Lesson.countDocuments({ course: course._id });
    if (lessonCount === 0) {
      throw HttpError.ruleViolation('A course needs at least one lesson before it can be published.');
    }
  }

  // Conditional on the status we checked, so two simultaneous requests cannot both apply.
  const result = await Course.updateOne({ _id: course._id, status: from }, { $set: { status: toStatus } });
  if (result.modifiedCount === 0) {
    throw HttpError.ruleViolation('This course was changed by someone else. Reload and try again.');
  }

  course.status = toStatus;
  await activityService.record({
    course: course._id,
    actor: actor._id,
    action: TRANSITION_ACTIONS[from][toStatus],
    changes: [{ field: 'status', from, to: toStatus }],
  });
  return { course, from, to: toStatus };
}

module.exports = {
  listCourses,
  getVisibleCourse,
  getCourseForEdit,
  createCourse,
  updateCourse,
  transitionCourse,
};
