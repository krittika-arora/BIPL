const User = require('../models/User');
const HttpError = require('../utils/httpError');

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

// Visitors are sent to log in. For page views, the page they wanted is passed along as
// ?next= so they come back to it afterwards (validated again in authController).
function requireAuth(req, res, next) {
  if (!req.user) {
    req.flash('warning', 'Please log in to continue.');
    const returnTo = req.method === 'GET' ? `?next=${encodeURIComponent(req.originalUrl)}` : '';
    return res.redirect(`/login${returnTo}`);
  }
  next();
}

// Server-side role gate. Hiding a button is not enough: every protected route uses this.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return requireAuth(req, res, next);
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to do that.'));
    }
    next();
  };
}

function guestOnly(req, res, next) {
  if (req.user) return res.redirect('/');
  next();
}

module.exports = { loadCurrentUser, requireAuth, requireRole, guestOnly };
