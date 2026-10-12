const passwordResetService = require('../services/passwordResetService');
const HttpError = require('../utils/httpError');
const { EMAIL_CODE } = require('../config/constants');
const { collectErrors } = require('../utils/validation');
const { maskEmail, secondsUntilResend } = require('../utils/oneTimeCode');

// Everything the visitor sees is driven by this session record, never by whether the email
// belongs to an account, so the pages behave identically for known and unknown addresses.
function startRequest(req, email) {
  req.session.passwordReset = { email, attempts: 0, sends: 1, lastRequestedAt: Date.now() };
}

function showForgot(req, res) {
  res.render('auth/forgot', { title: 'Forgot password', errors: {}, values: {} });
}

async function requestCode(req, res) {
  const values = { email: req.body.email };
  const errors = collectErrors(req);
  if (errors) {
    return res.status(422).render('auth/forgot', { title: 'Forgot password', errors, values });
  }

  try {
    await passwordResetService.requestReset(req.body.email);
  } catch (err) {
    if (err.status !== 503) throw err;
    return res
      .status(503)
      .render('auth/forgot', { title: 'Forgot password', errors: { form: err.message }, values });
  }

  startRequest(req, req.body.email);
  res.redirect('/forgot-password/reset');
}

function renderReset(req, res, status = 200, errors = {}) {
  const state = req.session.passwordReset;
  res.status(status).render('auth/reset', {
    title: 'Reset your password',
    maskedEmail: maskEmail(state.email),
    validMinutes: EMAIL_CODE.VALID_MINUTES,
    codeLength: EMAIL_CODE.LENGTH,
    resendInSeconds: secondsUntilResend(state.lastRequestedAt),
    canResend: state.sends < EMAIL_CODE.MAX_SENDS,
    errors,
  });
}

function showReset(req, res) {
  if (!req.session.passwordReset) return res.redirect('/forgot-password');
  renderReset(req, res);
}

async function reset(req, res) {
  const state = req.session.passwordReset;
  if (!state) return res.redirect('/forgot-password');

  const errors = collectErrors(req);
  if (errors) return renderReset(req, res, 422, errors);

  // Counted per browser session as well as per account, so the cut-off after 5 wrong codes
  // happens the same way whether or not the email has an account.
  state.attempts += 1;
  try {
    await passwordResetService.resetPassword(state.email, req.body.code, req.body.password);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    if (state.attempts >= EMAIL_CODE.MAX_ATTEMPTS) {
      delete req.session.passwordReset;
      req.flash('warning', 'Too many incorrect codes. Please request a new code.');
      return res.redirect('/forgot-password');
    }
    const left = EMAIL_CODE.MAX_ATTEMPTS - state.attempts;
    return renderReset(req, res, 422, {
      code: `${err.message} ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`,
    });
  }

  delete req.session.passwordReset;
  req.flash('success', 'Your password has been changed. Log in with your new password.');
  res.redirect('/login');
}

async function resend(req, res) {
  const state = req.session.passwordReset;
  if (!state) return res.redirect('/forgot-password');

  const wait = secondsUntilResend(state.lastRequestedAt);
  if (wait > 0) {
    req.flash('warning', `Please wait ${wait} seconds before requesting another code.`);
  } else if (state.sends >= EMAIL_CODE.MAX_SENDS) {
    req.flash('warning', 'No more codes can be sent right now. Please try again in an hour.');
  } else {
    try {
      await passwordResetService.requestReset(state.email);
      Object.assign(state, { attempts: 0, sends: state.sends + 1, lastRequestedAt: Date.now() });
      const masked = maskEmail(state.email);
      req.flash('success', `If an account exists for ${masked}, a new code is on its way.`);
    } catch (err) {
      if (err.status !== 503) throw err;
      req.flash('danger', err.message);
    }
  }
  res.redirect('/forgot-password/reset');
}

module.exports = { showForgot, requestCode, showReset, reset, resend };
