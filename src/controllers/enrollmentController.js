const enrollmentService = require('../services/enrollmentService');
const HttpError = require('../utils/httpError');
const { collectErrors } = require('../utils/validation');

async function enrolSelf(req, res) {
  try {
    const { course } = await enrollmentService.enrolSelf(req.user, req.params.id);
    req.flash('success', `You are enrolled in "${course.title}".`);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('info', err.message);
  }
  res.redirect(`/courses/${req.params.id}`);
}

// The form lives on the course page, so problems are reported there as a flash message.
async function enrolByEmail(req, res) {
  const coursePath = `/courses/${req.params.id}`;
  const errors = collectErrors(req);
  if (errors) {
    req.flash('danger', errors.email);
    return res.redirect(coursePath);
  }

  try {
    const { learner } = await enrollmentService.enrolByEmail(req.user, req.params.id, req.body.email);
    req.flash('success', `${learner.name} has been enrolled.`);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('danger', err.message);
  }
  res.redirect(coursePath);
}

async function myLearning(req, res) {
  const rows = await enrollmentService.listLearnerEnrollments(req.user._id);
  const counts = { not_started: 0, in_progress: 0, completed: 0 };
  for (const { enrollment } of rows) counts[enrollment.status] += 1;
  res.render('enrollments/my-learning', { title: 'My learning', rows, counts });
}

module.exports = { enrolSelf, enrolByEmail, myLearning };
