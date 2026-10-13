const alertService = require('../services/alertService');
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

module.exports = { index };
