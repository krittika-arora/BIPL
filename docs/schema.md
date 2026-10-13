# Schema

## Table by table: what columns and types does each one have?

MongoDB collections. Every collection has `_id` (ObjectId) and `createdAt` (Date); the ones that can change also have `updatedAt`.

- **users:** `name` String · `email` String (unique) · `passwordHash` String · `role` String (`instructor` / `learner`) · `passwordChangedAt` Date
- **courses:** `title` String · `description` String · `category` String (fixed list) · `status` String (`draft` / `published` / `archived`) · `instructor` ObjectId → users
- **lessons:** `course` ObjectId → courses · `title` String · `content` String · `position` Number
- **enrollments:** `learner` ObjectId → users · `course` ObjectId → courses · `enrolledBy` ObjectId → users · `status` String (`not_started` / `in_progress` / `completed`) · `completedLessons` [ObjectId → lessons] · `lastActivityAt` Date · `completedAt` Date
- **activitylogs:** `course` ObjectId → courses · `actor` ObjectId → users · `action` String · `subject` String · `message` String (comments) · `changes` [{ `field`, `from`, `to` }] · no `updatedAt` (entries never change)
- **alertdismissals:** `enrollment` ObjectId → enrollments · `course` ObjectId · `learner` ObjectId · `dismissedBy` ObjectId → users · `activityAtDismissal` Date · `dismissedAt` Date
- **pendingsignups:** `email` String (unique) · `name` String · `passwordHash` String · `codeHash` String · `codeExpiresAt` Date · `attempts` Number · `sendCount` Number · `lastSentAt` Date · `expiresAt` Date
- **passwordresets:** `email` String (unique) · `codeHash` String · `codeExpiresAt` Date · `attempts` Number · `sendCount` Number · `lastSentAt` Date · `expiresAt` Date
- **sessions:** managed by `connect-mongo` (session id, data, expiry)

## Which relationships are one-to-many, and which are many-to-many?

- **One-to-many:**
  - instructor (user) → courses they own
  - course → lessons
  - course → activity log entries
  - user → activity log entries they made
  - enrolment → alert dismissals
- **Many-to-many:** learners ↔ courses, through **enrollments**, which also holds each learner's progress on that course.
- **Many-to-many inside a document:** enrolment ↔ completed lessons, stored as an array of lesson ids.

## Which constraints are enforced by the database, and which by application code — and why did you draw the line there?

- **Database (MongoDB indexes):**
  - unique `users.email`;
  - unique `enrollments` (learner + course), so nobody is enrolled twice;
  - unique `alertdismissals` (enrolment + activity time);
  - unique email on `pendingsignups` and `passwordresets`;
  - TTL indexes that delete expired sign-ups and reset requests automatically.
- **Application code:**
  - Mongoose validation: required fields, allowed values, maximum lengths;
  - course and progress transition rules, and "publishing needs at least one lesson";
  - roles and course ownership;
  - the append-only activity log;
  - contiguous lesson positions.
- **Why the line is there:**
  - The database handles rules that must hold even when two requests arrive at the same moment (no duplicate accounts or enrolments).
  - Rules that depend on who is acting, or on other records (owner, transitions, lesson count), live in one service function each, because MongoDB has no foreign keys or check constraints for them.

## What did you deliberately denormalise?

- `enrollments.status` is stored, even though it could be worked out from `completedLessons`, so dashboards and alerts can count it quickly.
- `enrollments.completedLessons` is an array inside the enrolment rather than a separate table.
- `activitylogs.subject` copies the lesson title or learner name, so history still reads correctly after a rename or deletion.
- `alertdismissals` repeats `course` and `learner` for easy lookups and clean-up.

## What would break first if this had 100x the data?

- **Course search:** the case-insensitive text search cannot use an index, so it slows down first. Fix: a text index or Atlas Search.
- **Sorting by enrolment count:** it counts enrolments for every matching course. Fix: store a count on each course.
- **Dashboard and alert badge:** recalculated on every page load. Fix: add indexes on status and dates, and cache the numbers.
- **Activity log on busy courses:** the whole log is shown on one page. Fix: paginate it.
