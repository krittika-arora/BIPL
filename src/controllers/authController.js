const User = require('../models/User');
const signupService = require('../services/signupService');
const env = require('../config/env');
const HttpError = require('../utils/httpError');
const { SIGNUP_CODE } = require('../config/constants');
const { collectErrors } = require('../utils/validation');
const { safeLocalPath } = require('../utils/safeRedirect');

const SIGNUP_EXPIRED = 'Your sign-up has expired. Please fill in the form again.';

// Issues a fresh session id on sign-in to prevent session fixation.
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user.id;
      resolve();
    });
  });
}

// Where to go after signing in: the validated ?next= path, otherwise home.
function returnPath(value) {
  return safeLocalPath(value) || '/';
}

function showLogin(req, res) {
  const values = { next: safeLocalPath(req.query.next) || '' };
  res.render('auth/login', { title: 'Log in', errors: {}, values });
}

async function login(req, res) {
  const values = { email: req.body.email, next: safeLocalPath(req.body.next) || '' };
  const errors = collectErrors(req);
  if (errors) {
    return res.status(422).render('auth/login', { title: 'Log in', errors, values });
  }

  const user = await User.findOne({ email: req.body.email });
  const valid = user && (await user.verifyPassword(req.body.password));
  if (!valid) {
    return res.status(401).render('auth/login', {
      title: 'Log in',
      errors: { form: 'Incorrect email or password.' },
      values,
    });
  }

  await startSession(req, user);
  req.flash('success', `Welcome back, ${user.name}.`);
  res.redirect(returnPath(req.body.next));
}

function showRegister(req, res) {
  const values = { next: safeLocalPath(req.query.next) || '' };
  res.render('auth/register', { title: 'Create account', errors: {}, values });
}

// Step 1 of sign-up: validate, then email a code. The account (always a learner; instructor
// accounts are provisioned separately) is only created once the code is confirmed.
async function register(req, res) {
  const values = {
    name: req.body.name,
    email: req.body.email,
    next: safeLocalPath(req.body.next) || '',
  };
  const renderWithErrors = (errors) =>
    res.status(422).render('auth/register', { title: 'Create account', errors, values });

  const errors = collectErrors(req);
  if (errors) return renderWithErrors(errors);

  try {
    await signupService.startSignup({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
    });
  } catch (err) {
    if (!HttpError.isRuleViolation(err) && err.status !== 503) throw err;
    return renderWithErrors(err.field ? { [err.field]: err.message } : { form: err.message });
  }

  // Only the email and return path live in the session; the code is never stored anywhere readable.
  req.session.pendingSignup = { email: req.body.email, next: values.next };
  const masked = signupService.maskEmail(req.body.email);
  req.flash('info', `We have emailed a ${SIGNUP_CODE.LENGTH}-digit code to ${masked}.`);
  res.redirect('/register/verify');
}

function renderVerify(res, status, { email, signupStatus, error = null }) {
  res.status(status).render('auth/verify', {
    title: 'Verify your email',
    maskedEmail: signupService.maskEmail(email),
    validMinutes: SIGNUP_CODE.VALID_MINUTES,
    codeLength: SIGNUP_CODE.LENGTH,
    signupStatus,
    error,
    // Shown only when no SMTP server is configured (never in production; see env.js).
    devConsoleMail: env.mail.transport === 'console',
  });
}

// Sends the visitor back to the sign-up form, e.g. when their pending sign-up has expired.
function restartSignup(req, res, message) {
  delete req.session.pendingSignup;
  req.flash('warning', message);
  res.redirect('/register');
}

async function showVerify(req, res) {
  const pending = req.session.pendingSignup;
  if (!pending) return res.redirect('/register');
  const signupStatus = await signupService.getStatus(pending.email);
  if (!signupStatus) return restartSignup(req, res, SIGNUP_EXPIRED);
  renderVerify(res, 200, { email: pending.email, signupStatus });
}

// Step 2 of sign-up: check the code, create the account and sign the new learner in.
async function verify(req, res) {
  const pending = req.session.pendingSignup;
  if (!pending) return res.redirect('/register');

  const errors = collectErrors(req);
  if (errors) {
    const signupStatus = await signupService.getStatus(pending.email);
    if (!signupStatus) return restartSignup(req, res, SIGNUP_EXPIRED);
    return renderVerify(res, 422, { email: pending.email, signupStatus, error: errors.code });
  }

  let user;
  try {
    user = await signupService.verifyCode(pending.email, req.body.code);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    if (err.restart) return restartSignup(req, res, err.message);
    const signupStatus = await signupService.getStatus(pending.email);
    if (!signupStatus) return restartSignup(req, res, SIGNUP_EXPIRED);
    return renderVerify(res, 422, { email: pending.email, signupStatus, error: err.message });
  }

  const destination = returnPath(pending.next);
  await startSession(req, user);
  req.flash('success', 'Your email is verified and your account is ready. Welcome!');
  res.redirect(destination);
}

async function resend(req, res) {
  const pending = req.session.pendingSignup;
  if (!pending) return res.redirect('/register');
  try {
    await signupService.resendCode(pending.email);
    req.flash('success', `A new code is on its way to ${signupService.maskEmail(pending.email)}.`);
  } catch (err) {
    if (!HttpError.isRuleViolation(err) && err.status !== 503) throw err;
    if (err.restart) return restartSignup(req, res, err.message);
    req.flash('warning', err.message);
  }
  res.redirect('/register/verify');
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('coursetrack.sid');
    res.redirect('/login');
  });
}

module.exports = { showLogin, login, showRegister, register, showVerify, verify, resend, logout };
