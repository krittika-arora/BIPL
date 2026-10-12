const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { ROLES, COURSE_STATUS } = require('../config/constants');

async function getPublishedCourse(courseId) {
  const course = await Course.findOne({ _id: courseId, status: COURSE_STATUS.PUBLISHED });
  if (!course) throw new HttpError(404, 'Course not found.');
  return course;
}

function findEnrollment(learnerId, courseId) {
  return Enrollment.findOne({ learner: learnerId, course: courseId });
}

// Creates the enrolment; the unique index is the final guard against double enrolment.
async function createEnrollment({ learnerId, courseId, enrolledBy, duplicateMessage }) {
  if (await Enrollment.exists({ learner: learnerId, course: courseId })) {
    throw HttpError.ruleViolation(duplicateMessage);
  }
  try {
    return await Enrollment.create({ learner: learnerId, course: courseId, enrolledBy });
  } catch (err) {
    if (err.code === 11000) throw HttpError.ruleViolation(duplicateMessage);
    throw err;
  }
}

// Learners can only enrol themselves, and only in a published course.
async function enrolSelf(learner, courseId) {
  const course = await getPublishedCourse(courseId);
  const enrollment = await createEnrollment({
    learnerId: learner._id,
    courseId: course._id,
    enrolledBy: learner._id,
    duplicateMessage: 'You are already enrolled in this course.',
  });
  return { course, enrollment };
}

// Instructors enrol one learner at a time by email address.
async function enrolByEmail(actor, courseId, email) {
  // Instructors can see unpublished courses, so they get a reason rather than a 404.
  const course = await Course.findById(courseId);
  if (!course) throw new HttpError(404, 'Course not found.');
  if (course.status !== COURSE_STATUS.PUBLISHED) {
    throw HttpError.ruleViolation('Learners can only be enrolled in a published course.');
  }
  const learner = await User.findOne({ email }).lean();
  if (!learner) {
    throw HttpError.ruleViolation(`No account found for ${email}.`);
  }
  if (learner.role !== ROLES.LEARNER) {
    throw HttpError.ruleViolation(`${email} is an instructor account. Only learners can be enrolled.`);
  }
  const enrollment = await createEnrollment({
    learnerId: learner._id,
    courseId: course._id,
    enrolledBy: actor._id,
    duplicateMessage: `${learner.name} is already enrolled in this course.`,
  });
  return { course, learner, enrollment };
}

// Instructor view of everyone enrolled in a course. Never shown to learners.
function listCourseEnrollments(courseId) {
  return Enrollment.find({ course: courseId })
    .populate('learner', 'name email')
    .sort({ createdAt: 1 })
    .lean();
}

module.exports = { findEnrollment, enrolSelf, enrolByEmail, listCourseEnrollments };
