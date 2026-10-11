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

A course write and its log entry are two separate inserts. Transactions need a replica set, which a plain local MongoDB does not have. If the log write fails, the error reaches the error handler and the user sees a failure, but the course change remains.
**Revisit:** Atlas is a replica set, so wrapping these pairs in a session transaction becomes possible once deployed.
