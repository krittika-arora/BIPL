const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { collectErrors } = require('../utils/validation');
const { safeLocalPath } = require('../utils/safeRedirect');

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

// Self-registration always creates a learner; instructor accounts are provisioned separately.
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

  if (await User.exists({ email: req.body.email })) {
    return renderWithErrors({ email: 'An account with this email already exists.' });
  }

  let user;
  try {
    user = await User.create({
      name: req.body.name,
      email: req.body.email,
      passwordHash: await User.hashPassword(req.body.password),
      role: ROLES.LEARNER,
    });
  } catch (err) {
    // Two sign-ups racing for the same email: the unique index rejects the second.
    if (err.code === 11000) {
      return renderWithErrors({ email: 'An account with this email already exists.' });
    }
    throw err;
  }

  await startSession(req, user);
  req.flash('success', 'Your account has been created.');
  res.redirect(returnPath(req.body.next));
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('coursetrack.sid');
    res.redirect('/login');
  });
}

module.exports = { showLogin, login, showRegister, register, logout };
