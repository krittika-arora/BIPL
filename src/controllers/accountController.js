const accountService = require('../services/accountService');
const enrollmentService = require('../services/enrollmentService');
const HttpError = require('../utils/httpError');
const { ROLES } = require('../config/constants');
const { collectErrors } = require('../utils/validation');

async function renderAccount(req, res, status = 200, errors = {}) {
  const enrollmentCount =
    req.user.role === ROLES.LEARNER
      ? (await enrollmentService.listLearnerEnrollments(req.user._id)).length
      : 0;
  res.status(status).render('account/show', { title: 'My account', errors, enrollmentCount });
}

function show(req, res) {
  return renderAccount(req, res);
}

// Deletes the account of whoever is signed in. There is no user id in the URL or form.
async function destroy(req, res, next) {
  const errors = collectErrors(req);
  if (errors) return renderAccount(req, res, 422, errors);

  try {
    await accountService.deleteOwnAccount(req.user, req.body.password);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    return renderAccount(req, res, 422, { [err.field || 'form']: err.message });
  }

  // A fresh, empty session: the old one is gone, and any other device is signed out because
  // the user no longer exists (see loadCurrentUser).
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.flash('success', 'Your account and your course progress have been deleted.');
    res.redirect('/');
  });
}

module.exports = { show, destroy };
