const dashboardService = require('../services/dashboardService');
const enrollmentService = require('../services/enrollmentService');
const { ROLES, COURSE_STATUS, PROGRESS_STATUS } = require('../config/constants');

const LEARNER_HOME_LIMIT = 5;

// Instructors land on the dashboard; learners on a summary of their own progress only.
async function index(req, res) {
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
