const env = require('../config/env');

// A small set of standard protective headers (no extra dependency needed).
function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff', // never guess a different content type
    'X-Frame-Options': 'DENY', // cannot be framed by another site (clickjacking)
    'Referrer-Policy': 'same-origin', // page URLs are not sent to other sites
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  if (env.isProduction) {
    // Browsers keep using HTTPS for this site for a year once they have seen it.
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

module.exports = securityHeaders;
