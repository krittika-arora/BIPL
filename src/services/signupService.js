const crypto = require('crypto');
const PendingSignup = require('../models/PendingSignup');
const User = require('../models/User');
const mailService = require('./mailService');
const env = require('../config/env');
const HttpError = require('../utils/httpError');
const { ROLES, SIGNUP_CODE } = require('../config/constants');

const MINUTE = 60 * 1000;

// A problem that means the visitor has to start the sign-up again.
function restartError(message) {
  const err = HttpError.ruleViolation(message);
  err.restart = true;
  return err;
}

function generateCode() {
  return String(crypto.randomInt(0, 10 ** SIGNUP_CODE.LENGTH)).padStart(SIGNUP_CODE.LENGTH, '0');
}

// Keyed with the session secret, so a leaked database does not reveal codes.
function hashCode(email, code) {
  return crypto.createHmac('sha256', env.sessionSecret).update(`${email}:${code}`).digest('hex');
}

function codeMatches(pending, code) {
  const expected = Buffer.from(pending.codeHash, 'hex');
  const actual = Buffer.from(hashCode(pending.email, code), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function secondsUntilResend(pending, now = new Date()) {
  if (!pending.lastSentAt) return 0;
  const waitMs = pending.lastSentAt.getTime() + SIGNUP_CODE.RESEND_COOLDOWN_SECONDS * 1000 - now.getTime();
  return Math.max(0, Math.ceil(waitMs / 1000));
}

// Rate limits apply per email address, so restarting the form cannot be used to flood an inbox.
function assertCanSend(pending) {
  if (!pending) return;
  const wait = secondsUntilResend(pending);
  if (wait > 0) throw HttpError.ruleViolation(`Please wait ${wait} seconds before requesting another code.`);
  if (pending.sendCount >= SIGNUP_CODE.MAX_SENDS) {
    throw HttpError.ruleViolation('Too many codes have been sent to this address. Please try again in an hour.');
  }
}

// Stores a new code and emails it. If the email cannot be sent, the cooldown is lifted so the
// visitor can try again straight away.
async function issueCode(email, name, fields = {}) {
  const code = generateCode();
  const now = new Date();
  await PendingSignup.updateOne(
    { email },
    {
      $set: {
        ...fields,
        name,
        codeHash: hashCode(email, code),
        codeExpiresAt: new Date(now.getTime() + SIGNUP_CODE.VALID_MINUTES * MINUTE),
        attempts: 0,
        lastSentAt: now,
        expiresAt: new Date(now.getTime() + SIGNUP_CODE.PENDING_MINUTES * MINUTE),
      },
      $inc: { sendCount: 1 },
    },
    { upsert: true },
  );

  try {
    await mailService.sendSignupCode({ to: email, name, code, minutesValid: SIGNUP_CODE.VALID_MINUTES });
  } catch (err) {
    console.error(`Could not send verification email to ${email}: ${err.message}`);
    await PendingSignup.updateOne({ email }, { $set: { lastSentAt: null }, $inc: { sendCount: -1 } });
    throw new HttpError(503, 'We could not send the verification email just now. Please try again in a moment.');
  }
}

// Step 1: remember the sign-up details and email a code. No account is created yet.
async function startSignup({ name, email, password }) {
  if (await User.exists({ email })) {
    const err = HttpError.ruleViolation('An account with this email already exists.');
    err.field = 'email';
    throw err;
  }
  assertCanSend(await PendingSignup.findOne({ email }).lean());
  await issueCode(email, name, { passwordHash: await User.hashPassword(password) });
}

async function resendCode(email) {
  const pending = await PendingSignup.findOne({ email }).lean();
  if (!pending) throw restartError('Your sign-up has expired. Please fill in the form again.');
  assertCanSend(pending);
  await issueCode(email, pending.name);
}

// Step 2: check the code. Each attempt is counted atomically before comparing, so parallel
// guesses cannot exceed the limit. On success the real account is created.
async function verifyCode(email, code) {
  const pending = await PendingSignup.findOneAndUpdate(
    { email, attempts: { $lt: SIGNUP_CODE.MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  );
  if (!pending) {
    await PendingSignup.deleteOne({ email });
    throw restartError('This sign-up has expired or had too many incorrect codes. Please fill in the form again.');
  }

  if (!codeMatches(pending, code)) {
    const left = SIGNUP_CODE.MAX_ATTEMPTS - pending.attempts;
    if (left <= 0) {
      await PendingSignup.deleteOne({ _id: pending._id });
      throw restartError('Too many incorrect codes. Please fill in the form again.');
    }
    throw HttpError.ruleViolation(`That code is not correct. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
  }
  if (pending.codeExpiresAt < new Date()) {
    throw HttpError.ruleViolation('This code has expired. Request a new one below.');
  }

  let user;
  try {
    user = await User.create({
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
      role: ROLES.LEARNER,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    await PendingSignup.deleteOne({ _id: pending._id });
    throw restartError('An account with this email already exists. Please log in instead.');
  }
  await PendingSignup.deleteOne({ _id: pending._id });
  return user;
}

// For the verification page: null once the pending sign-up has gone.
async function getStatus(email) {
  const pending = await PendingSignup.findOne({ email }).lean();
  if (!pending) return null;
  return {
    resendInSeconds: secondsUntilResend(pending),
    sendsLeft: Math.max(0, SIGNUP_CODE.MAX_SENDS - pending.sendCount),
  };
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

module.exports = { startSignup, resendCode, verifyCode, getStatus, maskEmail };
