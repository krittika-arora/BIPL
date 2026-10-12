const enrollmentService = require('../services/enrollmentService');
const HttpError = require('../utils/httpError');

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

module.exports = { enrolSelf };
