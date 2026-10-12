const dashboardService = require('../services/dashboardService');

function pageFrom(query) {
  const page = Number.parseInt(typeof query.page === 'string' ? query.page : '', 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

// Renders a drill-down list, sending a page number past the end back to the last page.
function renderList(req, res, view, title, result, extra = {}) {
  if (result.total > 0 && result.page > result.pages) {
    return res.redirect(`${req.baseUrl}${req.path}?page=${result.pages}`);
  }
  return res.render(view, { title, ...result, basePath: `${req.baseUrl}${req.path}`, ...extra });
}

async function learners(req, res) {
  const result = await dashboardService.listLearners(pageFrom(req.query));
  renderList(req, res, 'dashboard/learners', 'Learners', result);
}

async function completions(req, res) {
  const result = await dashboardService.listCompletionsThisMonth(pageFrom(req.query));
  renderList(req, res, 'dashboard/completions', 'Completions this month', result);
}

async function inProgress(req, res) {
  const result = await dashboardService.listLearnersInProgress(pageFrom(req.query));
  renderList(req, res, 'dashboard/in-progress', 'Learners in progress', result);
}

module.exports = { learners, completions, inProgress };
