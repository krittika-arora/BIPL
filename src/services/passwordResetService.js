const PasswordReset = require('../models/PasswordReset');
const User = require('../models/User');
const mailService = require('./mailService');
const HttpError = require('../utils/httpError');
const { EMAIL_CODE } = require('../config/constants');
const { generateCode, hashCode, codeMatches, secondsUntilResend } = require('../utils/oneTimeCode');

const PURPOSE = 'password-reset';
const MINUTE = 60 * 1000;

// One message for every failure, so a wrong code, an expired code and an unknown email all
// look the same from outside.
function invalidCode() {
  return HttpError.ruleViolation('That code is not correct or has expired.');
}

// Emails a reset code if, and only if, the address belongs to an account. Returns nothing either
// way: callers must show the same response for known and unknown addresses. Per-address limits
// (60 s between emails, 5 per hour) are applied silently for the same reason.
async function requestReset(email) {
  const user = await User.findOne({ email }).select('name').lean();
  if (!user) return;

  const existing = await PasswordReset.findOne({ email }).lean();
  if (existing) {
    if (secondsUntilResend(existing.lastSentAt) > 0) return;
    if (existing.sendCount >= EMAIL_CODE.MAX_SENDS) return;
  }

  const code = generateCode();
  const now = new Date();
  await PasswordReset.updateOne(
    { email },
    {
      $set: {
        codeHash: hashCode(PURPOSE, email, code),
        codeExpiresAt: new Date(now.getTime() + EMAIL_CODE.VALID_MINUTES * MINUTE),
        attempts: 0,
        lastSentAt: now,
        expiresAt: new Date(now.getTime() + EMAIL_CODE.PENDING_MINUTES * MINUTE),
      },
      $inc: { sendCount: 1 },
    },
    { upsert: true },
  );

  try {
    await mailService.sendPasswordResetCode({
      to: email,
      name: user.name,
      code,
      minutesValid: EMAIL_CODE.VALID_MINUTES,
    });
  } catch (err) {
    console.error(`Could not send password reset email to ${email}: ${err.message}`);
    await PasswordReset.updateOne(
      { email },
      { $set: { lastSentAt: null }, $inc: { sendCount: -1 } },
    );
    throw new HttpError(503, 'We could not send the email just now. Please try again in a moment.');
  }
}

// Checks the code and sets the new password. Each attempt is counted atomically before comparing,
// and the fifth wrong code cancels the request. Setting passwordChangedAt signs out every
// existing session for the account (see loadCurrentUser).
async function resetPassword(email, code, newPassword) {
  const reset = await PasswordReset.findOneAndUpdate(
    { email, attempts: { $lt: EMAIL_CODE.MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  );
  if (!reset) throw invalidCode();

  const valid = codeMatches(reset.codeHash, PURPOSE, reset.email, code);
  if (!valid || reset.codeExpiresAt < new Date()) {
    if (reset.attempts >= EMAIL_CODE.MAX_ATTEMPTS) {
      await PasswordReset.deleteOne({ _id: reset._id });
    }
    throw invalidCode();
  }

  const user = await User.findOne({ email });
  await PasswordReset.deleteOne({ _id: reset._id });
  if (!user) throw invalidCode(); // account deleted after the code was sent

  user.passwordHash = await User.hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  return user;
}

module.exports = { requestReset, resetPassword };
