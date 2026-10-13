const AlertDismissal = require('../models/AlertDismissal');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { ROLES } = require('../config/constants');

// Deletes the signed-in learner's own account after re-checking their password.
// `actor` always comes from the session, never from the request, so nobody can name another
// account.
async function deleteOwnAccount(actor, password) {
  if (actor.role !== ROLES.LEARNER) {
    throw new HttpError(
      403,
      'Instructor accounts are managed by the training team and cannot be deleted here.',
    );
  }

  const user = await User.findById(actor._id);
  if (!user) throw new HttpError(404, 'Account not found.');
  if (!(await user.verifyPassword(password))) {
    const err = HttpError.ruleViolation(
      'That password is not correct. Your account has not been deleted.',
    );
    err.field = 'password';
    throw err;
  }

  // Enrolments first: if the user delete then failed, no orphaned progress would be left behind
  // counting towards the dashboard. The activity log is append-only and is kept (decision 27).
  const { deletedCount: enrollmentsDeleted } = await Enrollment.deleteMany({ learner: user._id });
  await AlertDismissal.deleteMany({ learner: user._id });
  await User.deleteOne({ _id: user._id });

  return { enrollmentsDeleted };
}

module.exports = { deleteOwnAccount };
