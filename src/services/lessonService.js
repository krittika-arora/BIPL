const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const HttpError = require('../utils/httpError');
const { COURSE_STATUS } = require('../config/constants');

const EDITABLE_FIELDS = ['title', 'content'];

function listLessons(courseId) {
  return Lesson.find({ course: courseId }).sort({ position: 1 }).lean();
}

async function getLesson(courseId, lessonId) {
  const lesson = await Lesson.findOne({ _id: lessonId, course: courseId });
  if (!lesson) throw new HttpError(404, 'Lesson not found.');
  return lesson;
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

  if (changes.length) await lesson.save();
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
  return { course, lesson };
}

module.exports = {
  listLessons,
  getLesson,
  getEditableCourse,
  addLesson,
  updateLesson,
  removeLesson,
};
