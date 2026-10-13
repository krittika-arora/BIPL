const alertService = require('../services/alertService');
const HttpError = require('../utils/httpError');
const { INACTIVITY_DAYS } = require('../config/constants');

function pageFrom(query) {
  const page = Number.parseInt(typeof query.page === 'string' ? query.page : '', 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

async function index(req, res) {
  const result = await alertService.listOpenAlerts(req.user._id, pageFrom(req.query));
  if (result.total > 0 && result.page > result.pages) {
    return res.redirect(`/alerts?page=${result.pages}`);
  }
  res.render('alerts/index', {
    title: 'Inactivity alerts',
    ...result,
    basePath: '/alerts',
    inactivityDays: INACTIVITY_DAYS,
  });
}

async function dismiss(req, res) {
  try {
    const { learnerName } = await alertService.dismissAlert(req.user, req.params.enrollmentId);
    req.flash(
      'success',
      `Alert for ${learnerName} dismissed. ` +
        'It will come back if they make progress and then go quiet again.',
    );
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('info', err.message);
  }
  const page = pageFrom(req.query);
  res.redirect(page > 1 ? `/alerts?page=${page}` : '/alerts');
}

module.exports = { index, dismiss };
