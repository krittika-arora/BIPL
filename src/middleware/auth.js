const User = require('../models/User');

// Loads the signed-in user (if any) on every request so routes and views can use it.
async function loadCurrentUser(req, res, next) {
  req.user = null;
  res.locals.currentUser = null;

  if (req.session.userId) {
    const user = await User.findById(req.session.userId).select('-passwordHash').lean();
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
    } else {
      delete req.session.userId;
    }
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.flash('warning', 'Please log in to continue.');
    return res.redirect('/login');
  }
  next();
}

function guestOnly(req, res, next) {
  if (req.user) return res.redirect('/');
  next();
}

module.exports = { loadCurrentUser, requireAuth, guestOnly };
