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

## 5. Only a course's own instructor can change it (reversed from "any instructor")

**Original decision (sessions 1–3):** the scenario describes "a couple of instructors" working as one team, so any instructor could edit any course.

**Reversed after session 3.** Reviewing the permissions as a whole showed that this let one instructor quietly edit, archive, or enrol people into a colleague's course, with nothing stopping it but good manners. The activity log would record who did it, but only after the fact. Instructors are accountable for their own courses, so the rule is now:

| Action on another instructor's course | Allowed |
| --- | --- |
| View the course and its lessons | Yes |
| View learner progress and enrolment details | Yes |
| Export learner progress as CSV | Yes |
| Comment in the course's activity log | Yes |
| Edit the course or its lessons (add, edit, reorder, remove) | No |
| Publish, archive or restore it | No |
| Enrol learners (single or bulk) | No |

The owner is the creator, already stored as `Course.instructor`. The check lives in one place (`src/utils/ownership.js`) and is called from the service functions that change a course: `courseService.getCourseForEdit`, `lessonService.getEditableCourse` and `enrollmentService.getCourseOpenForEnrolment` / `getCourseForBulkForm`. So it applies to the edit forms as well as the form submissions, and to any future route that reuses them. A non-owner gets 403. The course page hides those buttons for them and says whose course it is.
**Cost:** if an instructor leaves, their courses need a new owner. There is no transfer screen yet; it would be a small admin action that rewrites `Course.instructor` and logs the change.

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

## 16. Search uses an escaped, case-insensitive regex rather than a text index

Search must find "priv" inside "Privacy" and match partial words in descriptions. A MongoDB text index only matches whole (stemmed) words. The user's text is regex-escaped before use, so characters like `.*` are matched literally and cannot widen the query, and it is capped at 100 characters.
**Cost:** the regex cannot use an index; see "What breaks first at 100x" in `schema.md`.

## 17. The catalogue is one aggregation with `$facet`

Filtering, sorting and pagination all run in MongoDB. `$facet` returns the page of 10 and the total count from one query, so the "N courses found" number always matches the filters. Only whitelisted keys can reach `$sort` (`created`, `title`, `enrollments`), and every sort includes `_id` as a tie-breaker so pages never overlap or skip a course (checked: 23 courses over 3 pages, each exactly once).

Enrolment counts are looked up only for the courses on the current page, unless the user sorts by them, in which case they have to be computed before sorting. Unknown or malformed query values (including `q[$ne]=...` style operator injection) are dropped, never passed to the database. Learners are always limited to published courses, even if the URL asks for drafts. A page number past the end redirects to the last page.

## 18. Bulk enrolment reports per address and never fails as a whole

Each distinct address gets exactly one outcome: newly enrolled, already enrolled, unknown address, not a learner account, or invalid email. Duplicates in the input are collapsed and shown as "listed N times". One bad row never blocks the good ones. If two instructors enrol the same person at the same moment, the unique index catches it and that row is reported as "already enrolled".

A CSV with an `email` header uses just that column (so a `name,email` export works, including quoted names with commas); otherwise every cell is treated as an address. Limits: 100 KB per file, 500 distinct addresses per submission. Uploads use `multer` with in-memory storage: files are parsed immediately and never written to disk.

## 19. The CSV export defends against formula injection

Learner names are user-supplied. A name like `=HYPERLINK(...)` would run as a formula when an instructor opens the export in Excel. Any text cell starting with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with an apostrophe, and cells are quoted per RFC 4180. A UTF-8 BOM makes Excel show accented names correctly. Dates are ISO 8601 in UTC.

## 20. Dashboard figures are computed on the server, in UTC

Every figure is a MongoDB count or aggregation; no raw records are sent to the browser to be counted. "This month" and the chart's weeks (Monday-based, via `$dateTrunc`) are in UTC so they do not shift with the server's time zone. Weeks with no completions are filled in as zero, so the chart always shows eight bars.

The chart data is embedded once as JSON in a `<script type="application/json">` block, with `<` and the Unicode line separators escaped so no value can close the tag, and read by `public/js/dashboard.js`. A table version of the same numbers sits under the chart for screen readers.
**Cost:** a UTC week can differ by a few hours from a user's local week.

## 21. Who can comment, and who sees what

Instructors can comment on any course. Learners can comment only on a published course they are enrolled in. Learners see only the comments, not the edit, enrolment and transition history, which stays with instructors. Comments are ordinary activity-log entries, so they are just as permanent: there is no edit or delete, for anyone.

## 22. Demo history: created by the services, then moved into the past by a seed-only step

The dashboard needs weeks of history, but every service stamps "now". The seed therefore builds everything through the real services, so every rule check and log entry is genuine. Then `scripts/seedHistory.js` moves timestamps back:
- courses from about 12 weeks ago onwards, with their setup log entries and lessons;
- enrolments, completions and "instructor enrolled" entries after the course opened.

Later edits and comments keep their real time. A fixed random seed means every run gives the same data.

This is the one place outside the app that writes timestamps, and it has to use the raw driver: Mongoose treats `createdAt` as immutable, and the activity log's append-only guard (correctly) refuses the change. It runs only straight after the seed has dropped and rebuilt the database, before anyone uses the app. A check after seeding confirmed that no enrolment predates its course, no completion predates its enrolment or lies in the future, nobody in progress has been quiet for over 14 days, and every "instructor enrolled" entry matches its enrolment's time.

## 23. A public front door, with only generic information

Visitors who are not signed in can see the landing page (`/`), the catalogue (`/courses`) and course pages (`/courses/:id`), so people can find out what is on offer before they have an account. Everything else redirects them to log in.

| Visible to visitors | Never visible to visitors |
| --- | --- |
| Published courses: title, category, description, instructor name, lesson titles, enrolment count | Draft and archived courses (404, and excluded from every list and count) |
| Catalogue search, category and instructor filters, sorting, pagination | The status filter and status badges (ignored and hidden) |
| Number of published courses and categories on the landing page | Lesson content (requires enrolment) |
| Featured courses (the most-enrolled published courses) | Learner names, emails, progress and the roster |
| | The activity log and comments |
| | Any instructor email address |

The same server-side filter that limits learners to published courses now treats "no user" the same way, so there is one rule, not two. Pages render a visitor version rather than relying on hidden buttons. Every change still requires a signed-in user with the right role: visitors who POST anything are redirected to log in, and nothing is written.

**Why enrolment counts are shown:** they are aggregate numbers that help people choose a course, and they identify no one.

## 24. "Return to where you were" after logging in, without an open redirect

A visitor who clicks "Log in to enrol", or opens a link to a lesson, is sent to `/login?next=<that page>` and comes back to it after logging in or registering. The `next` value is carried in a hidden form field so it survives a wrong password. It is validated twice, when the form is shown and when it is submitted (`src/utils/safeRedirect.js`). Only a path inside this app is accepted: it must start with a single `/` and contain no backslashes or control characters. Anything else falls back to `/`, so a crafted link cannot send someone to another site after they sign in. Tested with `https://`, `//`, `/\\`, `javascript:`, a bare domain and a CR/LF header-injection attempt: all landed on `/`.

## 25. Email verification at sign-up: no account until the code is confirmed

Sign-up is two steps. The form creates a **pending sign-up**, not a user, and emails a 6-digit code. Only when the correct code is entered is the `User` created and the learner signed in. Unverified addresses therefore never appear as accounts. That keeps the rest of the system simple: bulk enrolment's "unknown address", the learner count on the dashboard and login all only ever see verified people. Pending sign-ups are deleted automatically by a TTL index.

How the code is protected:
- **Generation and storage.** Generated with `crypto.randomInt`. Stored only as an HMAC keyed with `SESSION_SECRET` and compared in constant time, so a leaked database does not reveal codes.
- **Lifetime and guesses.** Valid for 10 minutes. Every attempt is counted atomically *before* comparing (`findOneAndUpdate` with `attempts < 5`), so parallel guesses cannot exceed 5; the fifth wrong code cancels the sign-up.
- **Sending limits.** Emails to an address are limited to one per 60 seconds and 5 per pending sign-up. Restarting the form does not reset this, so the form cannot be used to flood someone's inbox.
- **No identifiers in URLs.** The browser only holds the email in its server-side session; the verification URL contains no email or token to tamper with.
- **Failed sends.** If the email cannot be sent, the visitor is told and may retry immediately (the cooldown is lifted).

**SMTP configuration** comes only from environment variables (`docs/email-setup.md`). Development without `SMTP_HOST` prints emails to the terminal so the app works with no mail account. Production refuses to start without it, so sign-up cannot silently break. `npm run mail:test` checks the settings on their own. This added one dependency, `nodemailer`, the standard SMTP client for Node.

**Accepted trade-off:** "An account with this email already exists" tells a visitor that an address is registered (account enumeration). It was already true before verification and is common practice for internal tools; a stricter version would always say "check your email" and send a "you already have an account" email instead.

## 26. Dashboard numbers open the list behind them, using the same filter

Each headline number links to the records it counts:

| Number | Opens |
| --- | --- |
| Total learners | `/dashboard/learners`: every learner, A–Z, with their enrolments by status and last activity |
| Published courses | `/courses?status=published`: the existing catalogue, already searchable, sortable and paginated |
| Completions this month | `/dashboard/completions`: each completion since the 1st (UTC): learner, course, enrolled and completed dates |
| Learners in progress | `/dashboard/in-progress`: each learner with a course underway, which courses, their % and last activity |

The filters behind the numbers (`learnerFilter`, `publishedFilter`, `completionsThisMonthFilter`, `inProgressFilter` in `dashboardService`) are shared by the counts and the lists. A list can therefore never disagree with its tile, for example by using a different month boundary. Each list is one MongoDB aggregation with `$facet` (a page of 20 plus the total) and a `$lookup` only for the rows on the page. The in-progress list computes % with the same rule as the rest of the app: only lessons that still exist count.

The pages show learner names and emails, so they are instructor-only (learners get 403; visitors are sent to log in). Instructors can see every course's learners here, in line with decision 5: viewing progress is allowed, and only changes are limited to a course's owner.

## 27. Learners can delete their own account, and only their own

"My account" (click your name in the navbar) shows the signed-in user's details. Learners also get a **Delete my account** section, which requires their current password and a ticked "cannot be undone" box.

- **Only your own account.** The account to delete is `req.user`, from the session. No route takes a user id, so there is nothing to change in a form or URL to target someone else. Extra fields such as `userId` are ignored (tested: Arjun submitting Neha's id deleted Arjun only). The password is checked against the signed-in user's own hash, so knowing someone else's password does not help.
- **Learners only.** Instructors get 403: they own courses (decision 5), so removing them would orphan those courses. Their accounts are managed by the training team.
- **What is deleted:** the user and all their enrolments and progress, so dashboards, rosters, exports and alerts no longer count them. Enrolments are deleted before the user, so a failure part-way cannot leave progress counted for a user who no longer exists. The session is replaced, and any other signed-in device is logged out on its next request, because `loadCurrentUser` no longer finds the user. The email address is free to sign up again (with a new verification code).
- **What is kept:** the course activity logs, which are append-only by design (decision 7). The person's comments stay, attributed to "Deleted user".

**Trade-off:** "learner enrolled" entries in the log copied the learner's name and email when they were written, so those remain in the history. Full erasure under data-protection law would need a redaction policy for the log, which conflicts with "history you cannot rewrite"; for an internal training record, keeping the audit trail was chosen deliberately.
