const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const HttpError = require('../utils/httpError');
const { COURSE_STATUS } = require('../config/constants');

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

module.exports = { findEnrollment, enrolSelf };
