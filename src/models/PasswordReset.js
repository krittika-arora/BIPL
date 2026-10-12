const mongoose = require('mongoose');

// An outstanding "forgot password" request. Only ever exists for a real account, but the app
// behaves identically for unknown emails, so it never reveals whether an account exists.
const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // HMAC of the code; the code itself is never stored.
    codeHash: { type: String, required: true },
    codeExpiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
    // TTL index: MongoDB removes the request once this time passes.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
