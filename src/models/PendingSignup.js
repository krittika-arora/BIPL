const mongoose = require('mongoose');

// A sign-up waiting for its email to be confirmed. No User exists until the code is entered,
// so unverified addresses never become accounts. MongoDB deletes these automatically.
const pendingSignupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true },
    // HMAC of the code; the code itself is never stored.
    codeHash: { type: String, required: true },
    codeExpiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
    // TTL index: the document is removed once this time passes.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PendingSignup', pendingSignupSchema);
