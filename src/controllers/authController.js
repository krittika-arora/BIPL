const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { collectErrors } = require('../utils/validation');

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

function showLogin(req, res) {
  res.render('auth/login', { title: 'Log in', errors: {}, values: {} });
}

async function login(req, res) {
  const values = { email: req.body.email };
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
  res.redirect('/');
}

function showRegister(req, res) {
  res.render('auth/register', { title: 'Create account', errors: {}, values: {} });
}

// Self-registration always creates a learner; instructor accounts are provisioned separately.
async function register(req, res) {
  const values = { name: req.body.name, email: req.body.email };
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
  res.redirect('/');
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('coursetrack.sid');
    res.redirect('/login');
  });
}

module.exports = { showLogin, login, showRegister, register, logout };
