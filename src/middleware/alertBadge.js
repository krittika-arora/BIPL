const alertService = require('../services/alertService');
const { ROLES } = require('../config/constants');

// Puts the instructor's open-alert count in the navbar: one aggregate count per page view.
// Skipped for learners, visitors and non-GET requests (which only redirect).
async function alertBadge(req, res, next) {
  res.locals.openAlertCount = 0;
  if (req.method === 'GET' && req.user && req.user.role === ROLES.INSTRUCTOR) {
    res.locals.openAlertCount = await alertService.countOpenAlerts(req.user._id);
  }
  next();
}

module.exports = alertBadge;
