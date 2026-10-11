const HttpError = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'The page you are looking for does not exist.'));
}

// Express recognises error handlers by their four-argument signature.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;

  // A malformed id in the URL means the record cannot exist.
  if (err.name === 'CastError') {
    status = 404;
    message = 'The requested record was not found.';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Something went wrong on our side. Please try again.';
  }

  res.status(status).render('errors/error', { title: `Error ${status}`, status, message });
}

module.exports = { notFound, errorHandler };
