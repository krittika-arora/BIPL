const mongoose = require('mongoose');
const { ACTIVITY_ACTIONS } = require('../config/constants');

const IMMUTABLE_MESSAGE = 'Activity log entries are append-only and cannot be modified or deleted.';

const activityLogSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, enum: Object.values(ACTIVITY_ACTIONS) },
    // For edits: which fields changed, from what, to what.
    changes: [
      {
        _id: false,
        field: { type: String, required: true },
        from: mongoose.Schema.Types.Mixed,
        to: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityLogSchema.index({ course: 1, createdAt: 1 });

async function rejectMutation() {
  throw new Error(IMMUTABLE_MESSAGE);
}

// Existing entries can never be saved again, updated or deleted through the model.
activityLogSchema.pre('save', async function preventResave() {
  if (!this.isNew) throw new Error(IMMUTABLE_MESSAGE);
});
activityLogSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ],
  { document: false, query: true },
  rejectMutation,
);
activityLogSchema.pre(['updateOne', 'deleteOne'], { document: true, query: false }, rejectMutation);
activityLogSchema.pre('bulkWrite', rejectMutation);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
