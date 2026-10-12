const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const progressService = require('./progressService');
const activityService = require('./activityService');
const HttpError = require('../utils/httpError');
const { COURSE_STATUS, ACTIVITY_ACTIONS } = require('../config/constants');

const EDITABLE_FIELDS = ['title', 'content'];

function listLessons(courseId) {
  return Lesson.find({ course: courseId }).sort({ position: 1 }).lean();
}

async function getLesson(courseId, lessonId) {
  const lesson = await Lesson.findOne({ _id: lessonId, course: courseId });
  if (!lesson) throw new HttpError(404, 'Lesson not found.');
  return lesson;
}

async function getNeighbours(courseId, position) {
  const [previous, next] = await Promise.all([
    Lesson.findOne({ course: courseId, position: position - 1 }).select('title').lean(),
    Lesson.findOne({ course: courseId, position: position + 1 }).select('title').lean(),
  ]);
  return { previous, next };
}

function logLessonActivity(actor, course, action, lessonTitle, changes = []) {
  return activityService.record({
    course: course._id,
    actor: actor._id,
    action,
    subject: lessonTitle,
    changes,
  });
}

// Lessons of an archived course are frozen until it is restored.
async function getEditableCourse(courseId) {
  const course = await Course.findById(courseId);
  if (!course) throw new HttpError(404, 'Course not found.');
  if (course.status === COURSE_STATUS.ARCHIVED) {
    throw HttpError.ruleViolation('This course is archived. Restore it before changing its lessons.');
  }
  return course;
}

async function addLesson(actor, courseId, data) {
  const course = await getEditableCourse(courseId);
  const last = await Lesson.findOne({ course: course._id }).sort({ position: -1 }).select('position').lean();

  const lesson = await Lesson.create({
    course: course._id,
    title: data.title,
    content: data.content,
    position: last ? last.position + 1 : 1,
  });
  await logLessonActivity(actor, course, ACTIVITY_ACTIONS.LESSON_ADDED, lesson.title);
  return { course, lesson };
}

async function updateLesson(actor, courseId, lessonId, data) {
  const course = await getEditableCourse(courseId);
  const lesson = await getLesson(course._id, lessonId);

  const changes = [];
  for (const field of EDITABLE_FIELDS) {
    if (data[field] !== undefined && data[field] !== lesson[field]) {
      changes.push({ field, from: lesson[field], to: data[field] });
      lesson[field] = data[field];
    }
  }

  if (changes.length) {
    await lesson.save();
    await logLessonActivity(actor, course, ACTIVITY_ACTIONS.LESSON_UPDATED, lesson.title, changes);
  }
  return { course, lesson, changes };
}

// Removes a lesson and closes the gap so positions stay 1..n.
async function removeLesson(actor, courseId, lessonId) {
  const course = await getEditableCourse(courseId);
  const lesson = await getLesson(course._id, lessonId);

  if (course.status === COURSE_STATUS.PUBLISHED) {
    const lessonCount = await Lesson.countDocuments({ course: course._id });
    if (lessonCount <= 1) {
      throw HttpError.ruleViolation(
        'A published course must keep at least one lesson. Archive the course instead.',
      );
    }
  }

  await lesson.deleteOne();
  await Lesson.updateMany(
    { course: course._id, position: { $gt: lesson.position } },
    { $inc: { position: -1 } },
  );
  await progressService.reconcileCourse(course._id);
  await logLessonActivity(actor, course, ACTIVITY_ACTIONS.LESSON_REMOVED, lesson.title);
  return { course, lesson };
}

// Swaps a lesson with its neighbour. direction is 'up' (earlier) or 'down' (later).
async function moveLesson(actor, courseId, lessonId, direction) {
  if (!['up', 'down'].includes(direction)) {
    throw new HttpError(400, 'Direction must be up or down.');
  }
  const course = await getEditableCourse(courseId);
  const lesson = await getLesson(course._id, lessonId);

  const neighbourPosition = direction === 'up' ? lesson.position - 1 : lesson.position + 1;
  const neighbour = await Lesson.findOne({ course: course._id, position: neighbourPosition });
  if (!neighbour) {
    throw HttpError.ruleViolation(
      direction === 'up' ? 'This lesson is already first.' : 'This lesson is already last.',
    );
  }

  const from = lesson.position;
  await Lesson.bulkWrite([
    { updateOne: { filter: { _id: lesson._id }, update: { $set: { position: neighbourPosition } } } },
    { updateOne: { filter: { _id: neighbour._id }, update: { $set: { position: from } } } },
  ]);
  lesson.position = neighbourPosition;
  await logLessonActivity(actor, course, ACTIVITY_ACTIONS.LESSON_MOVED, lesson.title, [
    { field: 'position', from, to: neighbourPosition },
  ]);
  return { course, lesson, from, to: neighbourPosition };
}

module.exports = {
  listLessons,
  getLesson,
  getNeighbours,
  getEditableCourse,
  addLesson,
  updateLesson,
  removeLesson,
  moveLesson,
};
