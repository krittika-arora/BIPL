const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
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

// The filters behind the headline numbers. The drill-down lists use exactly the same ones,
// so a list always contains as many rows as the number on its tile.
const learnerFilter = { role: ROLES.LEARNER };
const publishedFilter = { status: COURSE_STATUS.PUBLISHED };
const inProgressFilter = { status: PROGRESS_STATUS.IN_PROGRESS };
function completionsThisMonthFilter(now) {
  return { status: PROGRESS_STATUS.COMPLETED, completedAt: { $gte: startOfMonthUtc(now) } };
}

function countWhere(status) {
  return { $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] } };
}

// Every figure is computed by MongoDB; nothing is loaded into Node to be counted.
async function getInstructorDashboard(now = new Date()) {
  const [totalLearners, publishedCourses, completionsThisMonth, inProgress, byStatus, byCourse, weekly] =
    await Promise.all([
      User.countDocuments(learnerFilter),
      Course.countDocuments(publishedFilter),
      Enrollment.countDocuments(completionsThisMonthFilter(now)),
      // Distinct learners with at least one course in progress.
      Enrollment.aggregate([
        { $match: inProgressFilter },
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

// ---- Drill-down lists behind the headline numbers (instructors only) ----

const LIST_PAGE_SIZE = 20;

function pageStages(page) {
  return [{ $skip: (page - 1) * LIST_PAGE_SIZE }, { $limit: LIST_PAGE_SIZE }];
}

function paged(result, page) {
  const total = result.total.length ? result.total[0].n : 0;
  return {
    rows: result.rows,
    total,
    page,
    pageSize: LIST_PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / LIST_PAGE_SIZE)),
  };
}

const userNameStages = (field) => [
  {
    $lookup: {
      from: User.collection.name,
      localField: field,
      foreignField: '_id',
      pipeline: [{ $project: { name: 1, email: 1 } }],
      as: field,
    },
  },
  { $set: { [field]: { $first: '$' + field } } },
];

const courseTitleStages = (field) => [
  {
    $lookup: {
      from: Course.collection.name,
      localField: field,
      foreignField: '_id',
      pipeline: [{ $project: { title: 1, status: 1 } }],
      as: field,
    },
  },
  { $set: { [field]: { $first: '$' + field } } },
];

// "Total learners": every learner account with a summary of their enrolments.
async function listLearners(page) {
  const [result] = await User.aggregate([
    { $match: learnerFilter },
    { $sort: { name: 1, _id: 1 } },
    {
      $facet: {
        rows: [
          ...pageStages(page),
          {
            $lookup: {
              from: Enrollment.collection.name,
              localField: '_id',
              foreignField: 'learner',
              pipeline: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: 1 },
                    not_started: countWhere(PROGRESS_STATUS.NOT_STARTED),
                    in_progress: countWhere(PROGRESS_STATUS.IN_PROGRESS),
                    completed: countWhere(PROGRESS_STATUS.COMPLETED),
                    lastActivityAt: { $max: '$lastActivityAt' },
                  },
                },
              ],
              as: 'stats',
            },
          },
          { $set: { stats: { $first: '$stats' } } },
          { $project: { name: 1, email: 1, createdAt: 1, stats: 1 } },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]).collation({ locale: 'en', strength: 2 });
  return paged(result, page);
}

// "Completions this month": one row per course completed since the 1st (UTC), newest first.
async function listCompletionsThisMonth(page, now = new Date()) {
  const [result] = await Enrollment.aggregate([
    { $match: completionsThisMonthFilter(now) },
    { $sort: { completedAt: -1, _id: -1 } },
    {
      $facet: {
        rows: [
          ...pageStages(page),
          ...userNameStages('learner'),
          ...courseTitleStages('course'),
          { $project: { learner: 1, course: 1, createdAt: 1, completedAt: 1 } },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  return { ...paged(result, page), since: startOfMonthUtc(now) };
}

// "Learners in progress": each learner with at least one course in progress, and which ones.
async function listLearnersInProgress(page) {
  const [result] = await Enrollment.aggregate([
    { $match: inProgressFilter },
    {
      $group: {
        _id: '$learner',
        lastActivityAt: { $max: '$lastActivityAt' },
        courses: {
          $push: { course: '$course', completedLessons: '$completedLessons', lastActivityAt: '$lastActivityAt' },
        },
      },
    },
    { $sort: { lastActivityAt: -1, _id: 1 } },
    {
      $facet: {
        rows: [
          ...pageStages(page),
          { $set: { learner: '$_id' } },
          ...userNameStages('learner'),
          { $unwind: '$courses' },
          {
            $lookup: {
              from: Course.collection.name,
              localField: 'courses.course',
              foreignField: '_id',
              pipeline: [{ $project: { title: 1 } }],
              as: 'courseDoc',
            },
          },
          {
            $lookup: {
              from: Lesson.collection.name,
              localField: 'courses.course',
              foreignField: 'course',
              pipeline: [{ $project: { _id: 1 } }],
              as: 'lessons',
            },
          },
          {
            $set: {
              'courses.title': { $first: '$courseDoc.title' },
              // Same rule as everywhere else: only lessons that still exist count.
              'courses.percent': {
                $cond: [
                  { $gt: [{ $size: '$lessons' }, 0] },
                  {
                    $round: [
                      {
                        $multiply: [
                          {
                            $divide: [
                              { $size: { $setIntersection: ['$courses.completedLessons', '$lessons._id'] } },
                              { $size: '$lessons' },
                            ],
                          },
                          100,
                        ],
                      },
                      0,
                    ],
                  },
                  0,
                ],
              },
            },
          },
          {
            $group: {
              _id: '$_id',
              learner: { $first: '$learner' },
              lastActivityAt: { $first: '$lastActivityAt' },
              courses: {
                $push: {
                  id: '$courses.course',
                  title: '$courses.title',
                  percent: '$courses.percent',
                  lastActivityAt: '$courses.lastActivityAt',
                },
              },
            },
          },
          { $sort: { lastActivityAt: -1, _id: 1 } },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  return paged(result, page);
}

module.exports = {
  getInstructorDashboard,
  weeklyCompletions,
  startOfMonthUtc,
  startOfWeekUtc,
  listLearners,
  listCompletionsThisMonth,
  listLearnersInProgress,
};
