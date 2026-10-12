const mongoose = require('mongoose');
const { PROGRESS_STATUS } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

const enrollmentSchema = new mongoose.Schema(
  {
    learner: { type: ObjectId, ref: 'User', required: true },
    course: { type: ObjectId, ref: 'Course', required: true },
    // Who created the enrolment: the learner themselves or an instructor.
    enrolledBy: { type: ObjectId, ref: 'User', required: true },
    // Stored for fast filtering and reporting; only changed by progressService.
    status: {
      type: String,
      enum: Object.values(PROGRESS_STATUS),
      default: PROGRESS_STATUS.NOT_STARTED,
    },
    completedLessons: [{ type: ObjectId, ref: 'Lesson' }],
    // Last time the learner made progress. Drives inactivity alerts.
    lastActivityAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One enrolment per learner per course.
enrollmentSchema.index({ learner: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, status: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
