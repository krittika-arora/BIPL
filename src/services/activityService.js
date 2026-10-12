const ActivityLog = require('../models/ActivityLog');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const HttpError = require('../utils/httpError');
const { ROLES, COURSE_STATUS, ACTIVITY_ACTIONS } = require('../config/constants');

function record({ course, actor, action, subject, changes = [], message }) {
  return ActivityLog.create({ course, actor, action, subject, changes, message });
}

// Oldest first, so the log reads as a timeline.
function listForCourse(courseId) {
  return ActivityLog.find({ course: courseId })
    .populate('actor', 'name role')
    .sort({ createdAt: 1, _id: 1 })
    .lean();
}

// What learners see: comments only. Edits, enrolments and transitions stay with instructors.
function listComments(courseId) {
  return ActivityLog.find({ course: courseId, action: ACTIVITY_ACTIONS.COMMENT })
    .populate('actor', 'name role')
    .sort({ createdAt: 1, _id: 1 })
    .lean();
}

// Instructors can comment on any course; learners only on a published course they are enrolled in.
async function addComment(actor, courseId, message) {
  const course = await Course.findById(courseId).lean();
  if (!course) throw new HttpError(404, 'Course not found.');

  if (actor.role === ROLES.LEARNER) {
    if (course.status !== COURSE_STATUS.PUBLISHED) throw new HttpError(404, 'Course not found.');
    if (!(await Enrollment.exists({ course: course._id, learner: actor._id }))) {
      throw HttpError.ruleViolation('Enrol in this course to join the discussion.');
    }
  }

  return record({
    course: course._id,
    actor: actor._id,
    action: ACTIVITY_ACTIONS.COMMENT,
    message,
  });
}

module.exports = { record, listForCourse, listComments, addComment };
