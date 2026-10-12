# Design decisions

Each entry: what was decided, why, and what it costs.

## 1. Server-rendered EJS instead of a separate front-end app

Every page is rendered by Express. There is one deployable service, no CORS configuration, and every rule (roles, validation, transitions) runs on the server by construction, because there is no client-side state to trust.
**Cost:** fewer interactive touches; the progress chart on the dashboard will be the only client-side script beyond Bootstrap.

## 2. Sessions stored in MongoDB, not JWTs

`express-session` with `connect-mongo` reuses the existing database. Sign-out really ends the session (the record is destroyed), and the session id is regenerated on sign-in to prevent fixation. Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production.
**Cost:** one session lookup per request.

## 3. Self-registration creates learners only

Anyone with the link can create a learner account; instructor accounts are provisioned by the seed script (and would be by an admin process in a real deployment). Allowing a role choice on the sign-up form would let anyone make themselves an instructor.

## 4. Fixed list of course categories

Categories are a constant list (`src/config/constants.js`) validated on the server and by the schema enum. The brief needs a category for filtering and reporting, and with two instructors a managed category table would add screens without adding value.
**Cost:** adding a category needs a code change and deploy.

## 5. Any instructor can manage any course

The scenario describes "a couple of instructors" working as one training team, so course editing is not restricted to the creator. The creator is still stored (`Course.instructor`) for display and for the instructor filter.

## 6. All writes go through a service layer that also writes the activity log

Controllers never call `Course.create` or `save` directly; `courseService` does, and records the activity entry in the same function. One code path per change means a new route cannot forget to log.

## 7. Activity log is append-only at the model level

`ActivityLog` has Mongoose middleware that rejects re-saving, every update and delete query, document-level `updateOne`/`deleteOne`, and `bulkWrite`. No route edits or deletes entries.
**Limitation:** raw driver calls (`ActivityLog.collection.*`) bypass Mongoose. In production the full guarantee would come from a MongoDB user that only has insert and find privileges on that collection. The seed script deliberately resets the log by dropping the whole database, the one place this happens.

## 8. No multi-document transactions (yet)

A course or lesson write and its log entry are two separate writes. Transactions need a replica set, which a plain local MongoDB does not have. If the log write fails, the error reaches the error handler and the user sees a failure, but the course change remains.
**Revisit:** Atlas is a replica set, so wrapping these pairs in a session transaction becomes possible once deployed.

## 9. Course status changes go through one function with an explicit transition map

`COURSE_TRANSITIONS` in `src/config/constants.js` lists every legal move (`draft → published`, `published → archived`, `archived → published` for restore). `courseService.transitionCourse()` is the only code that changes `Course.status`. It rejects anything not in the map with a message naming the allowed moves, rejects publishing a course with no lessons, and writes the change with a filter on the old status (`updateOne({ _id, status: from })`), so two instructors clicking at once cannot both apply a transition. A rejected move writes nothing, including no log entry.
**Why a map rather than if/else:** the rules can be read in one place and the error message is generated from the same data, so they cannot drift apart.

## 10. Progress status is stored, but only `progressService` changes it

`Enrollment.status` could be derived from `completedLessons` on every read. It is stored because the dashboard, the roster and the upcoming inactivity alerts all need to filter and count by status in the database. That only works if the stored value can be trusted, so `progressService.completeLesson()` is the single writer. It walks `PROGRESS_TRANSITIONS` one legal step at a time (completing the only lesson of a one-lesson course goes `not_started → in_progress → completed` rather than skipping a state), adds the lesson atomically with `$addToSet` so a double click cannot count twice, and always acts on the signed-in learner's own enrolment, because the learner id comes from the session, never from the form.

## 11. Completion is permanent

If an instructor adds a lesson after a learner has completed a course, the learner stays `completed` (100%). Completion is a record of what happened (needed for compliance reporting), and silently "un-completing" people would make completion counts change under the instructor's feet.
**Cost:** a completed learner may not have seen the newest lesson. Re-assigning the course to them would be a follow-up feature.

## 12. Removing a lesson re-evaluates learners in progress

Progress % only counts lessons that still exist. Without a follow-up step, a learner who had finished every *other* lesson would be stuck in `in_progress` forever after the remaining lesson was deleted, because there is nothing left to complete. `lessonService.removeLesson()` therefore calls `progressService.reconcileCourse()`, which moves such learners to `completed` using the same transition rules. Removed lesson ids stay in `completedLessons` as history; they simply stop counting.

## 13. Archived courses are frozen, not hidden from their own learners' history

Archiving removes a course from the learner catalogue and its pages (learners get 404), blocks lesson changes until restored, and blocks new progress. Enrolments are untouched and still appear on "My learning" with an "Archived" label, so a learner's record is never lost. Restoring publishes the course again with everything intact. A published course cannot drop to zero lessons (removing the last one is refused); archiving is the way to retire it.

## 14. Lesson positions are not a unique index

Positions are kept contiguous (1..n) by the service: new lessons go to the end, removal shifts later lessons up by one, and moving swaps two neighbours. A unique `(course, position)` index would make the swap fail half-way, because the first update would briefly collide with the second.
**Cost:** two instructors adding a lesson to the same course at the same instant could get the same position. With a couple of instructors this is unlikely; a counter on the course document would close the gap if it ever mattered.

## 15. Lesson content is for enrolled learners only

Learners can browse a published course's description and lesson titles, but opening a lesson requires enrolling first. That way every learner who reads course content is enrolled, so their progress is tracked, which is the point of the system.
