const { validationResult } = require('express-validator');

// Returns { field: firstMessage } for failed checks, or null when the input is valid.
function collectErrors(req) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;

  const errors = {};
  for (const { path, msg } of result.array()) {
    if (!errors[path]) errors[path] = msg;
  }
  return errors;
}

module.exports = { collectErrors };
