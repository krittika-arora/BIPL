const activityService = require('../services/activityService');
const HttpError = require('../utils/httpError');
const { collectErrors } = require('../utils/validation');

// The comment box sits on the course page, so problems come back there as a flash message.
async function create(req, res) {
  const coursePath = `/courses/${req.params.id}`;
  const errors = collectErrors(req);
  if (errors) {
    req.flash('danger', errors.message);
    return res.redirect(`${coursePath}#discussion`);
  }

  try {
    await activityService.addComment(req.user, req.params.id, req.body.message);
    req.flash('success', 'Comment posted.');
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('warning', err.message);
  }
  res.redirect(`${coursePath}#discussion`);
}

module.exports = { create };
