const HttpError = require('./httpError');

// The instructor who created a course owns it. Other instructors can view it, follow its
// learners' progress and export it, but only the owner can change it. See docs/decisions.md.
function isCourseOwner(user, course) {
  if (!user || !course || !course.instructor) return false;
  const ownerId = course.instructor._id || course.instructor;
  return ownerId.toString() === user._id.toString();
}

function assertCourseOwner(user, course) {
  if (!isCourseOwner(user, course)) {
    throw new HttpError(403, 'Only the instructor who owns this course can change it or enrol learners.');
  }
}

module.exports = { isCourseOwner, assertCourseOwner };
