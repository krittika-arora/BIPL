const AlertDismissal = require('../models/AlertDismissal');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const activityService = require('./activityService');
const HttpError = require('../utils/httpError');
const { assertCourseOwner } = require('../utils/ownership');
const {
  COURSE_STATUS,
  PROGRESS_STATUS,
  INACTIVITY_DAYS,
  ACTIVITY_ACTIONS,
} = require('../config/constants');

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;

function inactivityCutoff(now) {
  return new Date(now.getTime() - INACTIVITY_DAYS * DAY_MS);
}

// Alerts are computed, not stored: a learner is "gone quiet" when their enrolment in one of this
// instructor's published courses is in progress and they last made progress more than
// INACTIVITY_DAYS ago. Starting from the instructor's courses keeps the query small.
function openAlertStages(instructorId, now) {
  return [
    { $match: { instructor: instructorId, status: COURSE_STATUS.PUBLISHED } },
    { $project: { title: 1 } },
    {
      $lookup: {
        from: Enrollment.collection.name,
        localField: '_id',
        foreignField: 'course',
        pipeline: [
          {
            $match: {
              status: PROGRESS_STATUS.IN_PROGRESS,
              lastActivityAt: { $lt: inactivityCutoff(now) },
            },
          },
          { $project: { learner: 1, lastActivityAt: 1, completedLessons: 1 } },
        ],
        as: 'enrollment',
      },
    },
    { $unwind: '$enrollment' },
    // Hidden only by a dismissal made at exactly the current lastActivityAt.
    {
      $lookup: {
        from: AlertDismissal.collection.name,
        let: { enrollmentId: '$enrollment._id', activityAt: '$enrollment.lastActivityAt' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$enrollment', '$$enrollmentId'] },
                  { $eq: ['$activityAtDismissal', '$$activityAt'] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'dismissal',
      },
    },
    { $match: { dismissal: { $size: 0 } } },
  ];
}

async function countOpenAlerts(instructorId, now = new Date()) {
  const [result] = await Course.aggregate([...openAlertStages(instructorId, now), { $count: 'n' }]);
  return result ? result.n : 0;
}

// Longest-quiet first, so the learners most at risk of dropping out are at the top.
async function listOpenAlerts(instructorId, page = 1, now = new Date()) {
  const [result] = await Course.aggregate([
    ...openAlertStages(instructorId, now),
    { $sort: { 'enrollment.lastActivityAt': 1, 'enrollment._id': 1 } },
    {
      $facet: {
        rows: [
          { $skip: (page - 1) * PAGE_SIZE },
          { $limit: PAGE_SIZE },
          {
            $lookup: {
              from: User.collection.name,
              localField: 'enrollment.learner',
              foreignField: '_id',
              pipeline: [{ $project: { name: 1, email: 1 } }],
              as: 'learner',
            },
          },
          { $set: { learner: { $first: '$learner' } } },
          {
            $lookup: {
              from: Lesson.collection.name,
              localField: '_id',
              foreignField: 'course',
              pipeline: [{ $project: { _id: 1 } }],
              as: 'lessons',
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);

  const total = result.total.length ? result.total[0].n : 0;
  const rows = result.rows.map((row) => ({
    enrollmentId: row.enrollment._id,
    course: { _id: row._id, title: row.title },
    learner: row.learner,
    lastActivityAt: row.enrollment.lastActivityAt,
    daysInactive: Math.floor((now.getTime() - row.enrollment.lastActivityAt.getTime()) / DAY_MS),
    enrollment: row.enrollment,
    lessonIds: row.lessons.map((lesson) => lesson._id),
  }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { rows, total, page, pageSize: PAGE_SIZE, pages };
}

// Dismisses the alert for one enrolment, recording the lastActivityAt it applies to.
// Only the course's owner can do this, and only while the alert is actually open.
async function dismissAlert(actor, enrollmentId, now = new Date()) {
  const enrollment = await Enrollment.findById(enrollmentId).populate('learner', 'name').lean();
  if (!enrollment) throw new HttpError(404, 'Alert not found.');
  const course = await Course.findById(enrollment.course).lean();
  if (!course) throw new HttpError(404, 'Alert not found.');
  assertCourseOwner(actor, course);

  const isOpen =
    course.status === COURSE_STATUS.PUBLISHED &&
    enrollment.status === PROGRESS_STATUS.IN_PROGRESS &&
    enrollment.lastActivityAt &&
    enrollment.lastActivityAt < inactivityCutoff(now);
  if (!isOpen) {
    throw HttpError.ruleViolation(
      'This learner is no longer inactive, so there is nothing to dismiss.',
    );
  }

  try {
    await AlertDismissal.create({
      enrollment: enrollment._id,
      course: course._id,
      learner: enrollment.learner._id,
      dismissedBy: actor._id,
      activityAtDismissal: enrollment.lastActivityAt,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    throw HttpError.ruleViolation('This alert has already been dismissed.');
  }

  await activityService.record({
    course: course._id,
    actor: actor._id,
    action: ACTIVITY_ACTIONS.ALERT_DISMISSED,
    subject: enrollment.learner.name,
  });
  return { learnerName: enrollment.learner.name, course };
}

module.exports = { countOpenAlerts, listOpenAlerts, dismissAlert, inactivityCutoff };
