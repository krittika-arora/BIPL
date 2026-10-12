const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const activityService = require('./activityService');
const HttpError = require('../utils/httpError');
const { isValidEmail } = require('../utils/emailList');
const {
  ROLES,
  COURSE_STATUS,
  ACTIVITY_ACTIONS,
  BULK_RESULT,
  BULK_MAX_ADDRESSES,
} = require('../config/constants');

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
// Instructors can see unpublished courses, so they get a reason rather than a 404.
async function getCourseOpenForEnrolment(courseId) {
  const course = await Course.findById(courseId);
  if (!course) throw new HttpError(404, 'Course not found.');
  if (course.status !== COURSE_STATUS.PUBLISHED) {
    throw HttpError.ruleViolation('Learners can only be enrolled in a published course.');
  }
  return course;
}

// For the bulk form: the course in any status (404 if missing), so the page can explain.
async function getCourseForBulkForm(courseId) {
  const course = await Course.findById(courseId).lean();
  if (!course) throw new HttpError(404, 'Course not found.');
  return course;
}

async function enrolByEmail(actor, courseId, email) {
  const course = await getCourseOpenForEnrolment(courseId);
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
  await activityService.record({
    course: course._id,
    actor: actor._id,
    action: ACTIVITY_ACTIONS.LEARNER_ENROLLED,
    subject: `${learner.name} (${learner.email})`,
  });
  return { course, learner, enrollment };
}

// Enrols every valid learner address and reports, per address, exactly what happened.
// One bad address never stops the others.
async function bulkEnrol(actor, courseId, addresses) {
  const course = await getCourseOpenForEnrolment(courseId);
  if (!addresses.length) {
    throw HttpError.ruleViolation('Paste at least one email address or upload a file.');
  }
  if (addresses.length > BULK_MAX_ADDRESSES) {
    throw HttpError.ruleViolation(
      `That list has ${addresses.length} different addresses. The limit is ${BULK_MAX_ADDRESSES} per upload.`,
    );
  }

  const validEmails = addresses.map((a) => a.email).filter(isValidEmail);
  const users = await User.find({ email: { $in: validEmails } }).select('name email role').lean();
  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  const alreadyEnrolled = new Set(
    (
      await Enrollment.find({ course: course._id, learner: { $in: users.map((u) => u._id) } })
        .select('learner')
        .lean()
    ).map((e) => e.learner.toString()),
  );

  const rows = [];
  for (const { email, occurrences } of addresses) {
    const row = { email, occurrences, name: null };
    const user = usersByEmail.get(email);
    if (!isValidEmail(email)) {
      row.result = BULK_RESULT.INVALID;
    } else if (!user) {
      row.result = BULK_RESULT.UNKNOWN;
    } else if (user.role !== ROLES.LEARNER) {
      row.name = user.name;
      row.result = BULK_RESULT.NOT_LEARNER;
    } else if (alreadyEnrolled.has(user._id.toString())) {
      row.name = user.name;
      row.result = BULK_RESULT.ALREADY_ENROLLED;
    } else {
      row.name = user.name;
      try {
        await Enrollment.create({ learner: user._id, course: course._id, enrolledBy: actor._id });
        row.result = BULK_RESULT.ENROLLED;
      } catch (err) {
        // Enrolled by someone else between the lookup and the insert.
        if (err.code !== 11000) throw err;
        row.result = BULK_RESULT.ALREADY_ENROLLED;
      }
    }
    rows.push(row);
  }

  const counts = Object.fromEntries(Object.values(BULK_RESULT).map((key) => [key, 0]));
  for (const row of rows) counts[row.result] += 1;

  if (counts[BULK_RESULT.ENROLLED] > 0) {
    await activityService.record({
      course: course._id,
      actor: actor._id,
      action: ACTIVITY_ACTIONS.LEARNERS_BULK_ENROLLED,
      subject:
        `${counts.enrolled} newly enrolled, ${counts.already_enrolled} already enrolled, ` +
        `${counts.unknown} unknown, ${counts.not_learner} not learners, ${counts.invalid} invalid`,
    });
  }
  return { course, rows, counts };
}

// Instructor view of everyone enrolled in a course. Never shown to learners.
function listCourseEnrollments(courseId) {
  return Enrollment.find({ course: courseId })
    .populate('learner', 'name email')
    .sort({ createdAt: 1 })
    .lean();
}

// Every course a learner is enrolled in, with the lesson ids needed to compute progress.
async function listLearnerEnrollments(learnerId) {
  const enrollments = await Enrollment.find({ learner: learnerId })
    .populate('course', 'title category status')
    .sort({ updatedAt: -1 })
    .lean();

  const courseIds = enrollments.filter((e) => e.course).map((e) => e.course._id);
  const lessonGroups = await Lesson.aggregate([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: '$course', lessonIds: { $push: '$_id' } } },
  ]);
  const lessonsByCourse = new Map(lessonGroups.map((g) => [g._id.toString(), g.lessonIds]));

  return enrollments
    .filter((e) => e.course)
    .map((enrollment) => ({
      enrollment,
      course: enrollment.course,
      lessonIds: lessonsByCourse.get(enrollment.course._id.toString()) || [],
    }));
}

module.exports = {
  findEnrollment,
  enrolSelf,
  enrolByEmail,
  bulkEnrol,
  getCourseOpenForEnrolment,
  getCourseForBulkForm,
  listCourseEnrollments,
  listLearnerEnrollments,
};
