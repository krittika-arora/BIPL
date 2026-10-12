const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { ROLES, COURSE_STATUS, PROGRESS_STATUS } = require('../config/constants');

// Reporting periods use UTC so the numbers do not depend on the server's time zone.
function startOfMonthUtc(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS_CHARTED = 8;
const weekLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Monday 00:00 UTC of the week containing `now`.
function startOfWeekUtc(now) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - daysSinceMonday * DAY_MS);
}

// Completions per week for the last 8 weeks (this week included), zero-filled.
async function weeklyCompletions(now = new Date(), weeks = WEEKS_CHARTED) {
  const firstWeek = new Date(startOfWeekUtc(now).getTime() - (weeks - 1) * 7 * DAY_MS);
  const counted = await Enrollment.aggregate([
    { $match: { status: PROGRESS_STATUS.COMPLETED, completedAt: { $gte: firstWeek } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$completedAt', unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } },
        count: { $sum: 1 },
      },
    },
  ]);
  const countByWeek = new Map(counted.map(({ _id, count }) => [_id.getTime(), count]));

  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = new Date(firstWeek.getTime() + i * 7 * DAY_MS);
    return {
      weekStart: weekStart.toISOString().slice(0, 10),
      label: weekLabel.format(weekStart),
      count: countByWeek.get(weekStart.getTime()) || 0,
    };
  });
}

function countWhere(status) {
  return { $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] } };
}

// Every figure is computed by MongoDB; nothing is loaded into Node to be counted.
async function getInstructorDashboard(now = new Date()) {
  const [totalLearners, publishedCourses, completionsThisMonth, inProgress, byStatus, byCourse, weekly] =
    await Promise.all([
      User.countDocuments({ role: ROLES.LEARNER }),
      Course.countDocuments({ status: COURSE_STATUS.PUBLISHED }),
      Enrollment.countDocuments({
        status: PROGRESS_STATUS.COMPLETED,
        completedAt: { $gte: startOfMonthUtc(now) },
      }),
      // Distinct learners with at least one course in progress.
      Enrollment.aggregate([
        { $match: { status: PROGRESS_STATUS.IN_PROGRESS } },
        { $group: { _id: '$learner' } },
        { $count: 'n' },
      ]),
      Enrollment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Enrollment.aggregate([
        {
          $group: {
            _id: '$course',
            total: { $sum: 1 },
            not_started: countWhere(PROGRESS_STATUS.NOT_STARTED),
            in_progress: countWhere(PROGRESS_STATUS.IN_PROGRESS),
            completed: countWhere(PROGRESS_STATUS.COMPLETED),
          },
        },
        {
          $lookup: {
            from: Course.collection.name,
            localField: '_id',
            foreignField: '_id',
            pipeline: [{ $project: { title: 1, status: 1 } }],
            as: 'course',
          },
        },
        { $set: { course: { $first: '$course' } } },
        { $match: { course: { $ne: null } } },
        { $sort: { total: -1, 'course.title': 1 } },
      ]),
      weeklyCompletions(now),
    ]);

  const statusCounts = Object.fromEntries(Object.values(PROGRESS_STATUS).map((s) => [s, 0]));
  for (const { _id, count } of byStatus) statusCounts[_id] = count;

  return {
    headline: {
      totalLearners,
      publishedCourses,
      completionsThisMonth,
      learnersInProgress: inProgress.length ? inProgress[0].n : 0,
    },
    statusCounts,
    totalEnrollments: Object.values(statusCounts).reduce((sum, n) => sum + n, 0),
    byCourse,
    weekly,
  };
}

module.exports = { getInstructorDashboard, weeklyCompletions, startOfMonthUtc, startOfWeekUtc };
