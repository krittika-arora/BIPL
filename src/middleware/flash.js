// One-time messages stored in the session and shown on the next page render.
function flash(req, res, next) {
  res.locals.flash = req.session.flash || [];
  if (req.session.flash) delete req.session.flash;

  req.flash = (type, message) => {
    req.session.flash = [...(req.session.flash || []), { type, message }];
  };

  next();
}

module.exports = flash;
