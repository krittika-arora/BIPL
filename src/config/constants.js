const ROLES = Object.freeze({
  INSTRUCTOR: 'instructor',
  LEARNER: 'learner',
});

const COURSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

// The only legal course moves. Anything not listed here is rejected by courseService.
// archived -> published is "restore".
const COURSE_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['published']),
  published: Object.freeze(['archived']),
  archived: Object.freeze(['published']),
});

// A learner's progress through one course they are enrolled in.
const PROGRESS_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

// The only legal progress moves, applied one step at a time by progressService.
const PROGRESS_TRANSITIONS = Object.freeze({
  not_started: Object.freeze(['in_progress']),
  in_progress: Object.freeze(['completed']),
  completed: Object.freeze([]),
});

// A fixed list keeps filtering and reporting consistent; see docs/decisions.md.
const COURSE_CATEGORIES = Object.freeze([
  'Onboarding',
  'Compliance',
  'Technical Skills',
  'Leadership',
  'Communication',
]);

const ACTIVITY_ACTIONS = Object.freeze({
  CREATED: 'created',
  UPDATED: 'updated',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
  RESTORED: 'restored',
  LESSON_ADDED: 'lesson_added',
  LESSON_UPDATED: 'lesson_updated',
  LESSON_REMOVED: 'lesson_removed',
  LESSON_MOVED: 'lesson_moved',
  LEARNER_ENROLLED: 'learner_enrolled',
  LEARNERS_BULK_ENROLLED: 'learners_bulk_enrolled',
  COMMENT: 'comment',
  ALERT_DISMISSED: 'alert_dismissed',
  DELETED: 'deleted',
});

const COMMENT_MAX_LENGTH = 1000;

// Outcome categories reported for each address in a bulk enrolment.
const BULK_RESULT = Object.freeze({
  INVALID: 'invalid',
  UNKNOWN: 'unknown',
  NOT_LEARNER: 'not_learner',
  ALREADY_ENROLLED: 'already_enrolled',
  ENROLLED: 'enrolled',
});

const BULK_MAX_ADDRESSES = 500;

// An in-progress learner with no progress for more than this many days raises an alert.
const INACTIVITY_DAYS = 14;

// One-time codes sent by email (sign-up verification and password reset).
const EMAIL_CODE = Object.freeze({
  LENGTH: 6,
  VALID_MINUTES: 10, // how long one emailed code works
  MAX_ATTEMPTS: 5, // wrong guesses before the sign-up is cancelled
  RESEND_COOLDOWN_SECONDS: 60, // minimum gap between emails to the same address
  MAX_SENDS: 5, // emails per pending sign-up, so nobody can flood an inbox
  PENDING_MINUTES: 60, // an unfinished sign-up or reset request is deleted after this long
});

module.exports = {
  ROLES,
  EMAIL_CODE,
  INACTIVITY_DAYS,
  COURSE_STATUS,
  COURSE_TRANSITIONS,
  PROGRESS_STATUS,
  PROGRESS_TRANSITIONS,
  COURSE_CATEGORIES,
  ACTIVITY_ACTIONS,
  BULK_RESULT,
  BULK_MAX_ADDRESSES,
  COMMENT_MAX_LENGTH,
};
