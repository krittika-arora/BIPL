const dashboardService = require('../services/dashboardService');
const enrollmentService = require('../services/enrollmentService');
const courseService = require('../services/courseService');
const { parseCatalogueQuery } = require('../utils/catalogueQuery');
const {
  ROLES,
  COURSE_STATUS,
  COURSE_CATEGORIES,
  PROGRESS_STATUS,
} = require('../config/constants');

const LEARNER_HOME_LIMIT = 5;
const FEATURED_LIMIT = 6;

// Public landing page: only published courses and generic counts, nothing about learners.
async function landing(req, res) {
  const params = parseCatalogueQuery({ sort: 'enrollments', dir: 'desc' }, null);
  const [{ courses, total }, categoryCount] = await Promise.all([
    courseService.listCourses(null, params),
    courseService.countPublishedCategories(),
  ]);
  res.render('home/landing', {
    title: 'Learn new skills. Track your growth.',
    featured: courses.slice(0, FEATURED_LIMIT),
    publishedCount: total,
    categoryCount,
    categories: COURSE_CATEGORIES,
  });
}

// Visitors see the landing page; instructors the dashboard; learners their own progress only.
async function index(req, res) {
  if (!req.user) return landing(req, res);

  if (req.user.role === ROLES.INSTRUCTOR) {
    const dashboard = await dashboardService.getInstructorDashboard();
    return res.render('home/instructor', { title: 'Dashboard', ...dashboard });
  }

  const rows = await enrollmentService.listLearnerEnrollments(req.user._id);
  const counts = Object.fromEntries(Object.values(PROGRESS_STATUS).map((s) => [s, 0]));
  for (const { enrollment } of rows) counts[enrollment.status] += 1;
  const continueRows = rows
    .filter(
      ({ enrollment, course }) =>
        enrollment.status !== PROGRESS_STATUS.COMPLETED && course.status === COURSE_STATUS.PUBLISHED,
    )
    .slice(0, LEARNER_HOME_LIMIT);
  res.render('home/learner', { title: 'Home', counts, continueRows });
}

module.exports = { index };
