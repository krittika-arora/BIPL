const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const HttpError = require('../utils/httpError');
const { allLessonsCompleted } = require('../utils/progress');
const { COURSE_STATUS, PROGRESS_STATUS, PROGRESS_TRANSITIONS } = require('../config/constants');

function assertTransition(from, to) {
  if (!PROGRESS_TRANSITIONS[from].includes(to)) {
    throw HttpError.ruleViolation(`Progress cannot move from ${from} to ${to}.`);
  }
}

// Walks the transition map one legal step at a time until the status matches the lessons done.
function resolveStatus(enrollment, lessonIds) {
  let status = enrollment.status;
  if (status === PROGRESS_STATUS.NOT_STARTED && enrollment.completedLessons.length > 0) {
    assertTransition(status, PROGRESS_STATUS.IN_PROGRESS);
    status = PROGRESS_STATUS.IN_PROGRESS;
  }
  if (status === PROGRESS_STATUS.IN_PROGRESS && allLessonsCompleted(enrollment, lessonIds)) {
    assertTransition(status, PROGRESS_STATUS.COMPLETED);
    status = PROGRESS_STATUS.COMPLETED;
  }
  return status;
}

// Saves a status change only if nobody else changed the status in the meantime.
async function applyStatus(enrollment, status, now) {
  if (status === enrollment.status) return enrollment;
  const update = { status };
  if (status === PROGRESS_STATUS.COMPLETED) update.completedAt = now;
  await Enrollment.updateOne({ _id: enrollment._id, status: enrollment.status }, { $set: update });
  Object.assign(enrollment, update);
  return enrollment;
}

// The single entry point for learner progress. Always acts on the caller's own enrolment.
async function completeLesson(learner, courseId, lessonId) {
  const course = await Course.findById(courseId);
  if (!course) throw new HttpError(404, 'Course not found.');
  if (course.status !== COURSE_STATUS.PUBLISHED) {
    throw HttpError.ruleViolation('This course is not open for progress right now.');
  }

  const enrollment = await Enrollment.findOne({ learner: learner._id, course: course._id });
  if (!enrollment) throw HttpError.ruleViolation('You are not enrolled in this course.');

  const lesson = await Lesson.findOne({ _id: lessonId, course: course._id });
  if (!lesson) throw new HttpError(404, 'Lesson not found.');

  if (enrollment.status === PROGRESS_STATUS.COMPLETED) {
    throw HttpError.ruleViolation('You have already completed this course.');
  }

  // Atomic: a double click cannot record the same lesson twice.
  const now = new Date();
  const updated = await Enrollment.findOneAndUpdate(
    { _id: enrollment._id, completedLessons: { $ne: lesson._id } },
    { $addToSet: { completedLessons: lesson._id }, $set: { lastActivityAt: now } },
    { returnDocument: 'after' },
  );
  if (!updated) throw HttpError.ruleViolation('You have already completed this lesson.');

  const lessonIds = await Lesson.find({ course: course._id }).distinct('_id');
  await applyStatus(updated, resolveStatus(updated, lessonIds), now);
  return { course, lesson, enrollment: updated };
}

// After a lesson is removed, learners who have now finished every remaining lesson are completed.
async function reconcileCourse(courseId) {
  const lessonIds = await Lesson.find({ course: courseId }).distinct('_id');
  const inProgress = await Enrollment.find({ course: courseId, status: PROGRESS_STATUS.IN_PROGRESS });
  const now = new Date();
  for (const enrollment of inProgress) {
    await applyStatus(enrollment, resolveStatus(enrollment, lessonIds), now);
  }
}

module.exports = { completeLesson, reconcileCourse };
