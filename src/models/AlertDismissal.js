const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// An instructor dismissed the inactivity alert for one enrolment. It only hides the alert while
// the learner's lastActivityAt still equals activityAtDismissal: once they make progress again,
// this record no longer matches, so after another quiet spell the alert comes back by itself.
const alertDismissalSchema = new mongoose.Schema(
  {
    enrollment: { type: ObjectId, ref: 'Enrollment', required: true },
    course: { type: ObjectId, ref: 'Course', required: true },
    learner: { type: ObjectId, ref: 'User', required: true },
    dismissedBy: { type: ObjectId, ref: 'User', required: true },
    activityAtDismissal: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'dismissedAt', updatedAt: false } },
);

// One dismissal per quiet spell; also the index the open-alerts query looks up.
alertDismissalSchema.index({ enrollment: 1, activityAtDismissal: 1 }, { unique: true });

module.exports = mongoose.model('AlertDismissal', alertDismissalSchema);
