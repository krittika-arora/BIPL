const crypto = require('crypto');
const HttpError = require('../utils/httpError');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FAILURE_MESSAGE =
  'This form has expired or did not come from CourseTrack. Go back, reload the page and try again.';

// One random token per session, created the first time a page shows a form.
function sessionToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function tokensMatch(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

// Rejects a state-changing request unless it carries this session's token, so another site
// cannot make a signed-in user's browser submit a form here.
function verifyCsrf(req, res, next) {
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!tokensMatch(req.session.csrfToken, sent)) return next(new HttpError(403, FAILURE_MESSAGE));
  next();
}

// Global middleware. Views call csrfToken() inside each POST form. Multipart forms (file uploads)
// are skipped here because their fields are only parsed later by the route; those routes call
// verifyCsrf themselves right after the upload middleware.
function csrfProtection(req, res, next) {
  res.locals.csrfToken = () => sessionToken(req);
  if (SAFE_METHODS.has(req.method) || req.is('multipart/form-data')) return next();
  verifyCsrf(req, res, next);
}

module.exports = { csrfProtection, verifyCsrf };
