// Shared by sign-up verification and password reset: the 6-digit codes sent by email.
const crypto = require('crypto');
const env = require('../config/env');
const { EMAIL_CODE } = require('../config/constants');

function generateCode() {
  return String(crypto.randomInt(0, 10 ** EMAIL_CODE.LENGTH)).padStart(EMAIL_CODE.LENGTH, '0');
}

// Keyed with the session secret, so a leaked database does not reveal codes. `purpose` stops a
// code issued for one flow (e.g. sign-up) from ever being accepted by another (password reset).
function hashCode(purpose, email, code) {
  return crypto
    .createHmac('sha256', env.sessionSecret)
    .update(`${purpose}:${email}:${code}`)
    .digest('hex');
}

function codeMatches(storedHash, purpose, email, code) {
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashCode(purpose, email, code), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function secondsUntilResend(lastSentAt, now = new Date()) {
  if (!lastSentAt) return 0;
  const resendAt = new Date(lastSentAt).getTime() + EMAIL_CODE.RESEND_COOLDOWN_SECONDS * 1000;
  const waitMs = resendAt - now.getTime();
  return Math.max(0, Math.ceil(waitMs / 1000));
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

module.exports = { generateCode, hashCode, codeMatches, secondsUntilResend, maskEmail };
