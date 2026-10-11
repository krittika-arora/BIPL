# Build plan

The work is split into four sessions. Each session ends with the app running and committed, so any session's last commit is a usable version.

| Session | Focus | Goals covered | Estimate | Actual |
| --- | --- | --- | --- | --- |
| 1 | Setup, auth and roles, courses, activity log, seed | 1, 2 (partial), 9 (partial) | 5h | |
| 2 | Lessons, course lifecycle, enrollment, progress | 2, 3, 4, 5, 9 | 6h | |
| 3 | Catalogue search, bulk enrollment, CSV export, dashboard, comments | 6, 7, 8, 9 | 6h | |
| 4 | Inactivity alerts, tests, security pass, deployment, docs | 10, plus hardening | 5h | |

## Session 1: foundation

- Express 5 + EJS + Bootstrap layout, MongoDB connection, config from environment variables only.
- Email/password sign-in with sessions stored in MongoDB; self-registration creates learners only.
- `requireRole` middleware on every instructor route.
- Course model; instructors create and edit courses (start as draft).
- Append-only activity log written by the course service on every change.
- Seed script with two instructors, six learners and six courses.

## Session 2: course content and learner progress

- Lessons: add, edit, remove, reorder; course page lists lessons in order.
- Course lifecycle `draft → published → archived` (and restore) in one service function that rejects illegal moves and refuses to publish a course with no lessons.
- Enrollment: learners self-enrol in published courses; instructors enrol a single learner.
- Progress `not_started → in_progress → completed`, driven by lesson completion; "My learning" page.
- Every lesson change and lifecycle transition written to the activity log.

## Session 3: finding, bulk work and reporting

- Course catalogue with server-side text search, category/status/instructor filters, sorting (title, created date, enrollment count) and pagination with a total count.
- Bulk enrollment from pasted or uploaded email lists with a per-address result.
- Per-course progress CSV export.
- Dashboard: headline numbers, enrollments by course and by progress state, 8-week completions chart.
- Comments on the course activity log.

## Session 4: alerts, quality and delivery

- Inactivity alerts (In Progress with no progress for more than 14 days), dismiss per learner and course, reappear after renewed activity followed by another quiet period; count badge in the navbar.
- Automated tests for the rules that matter most (roles, transitions, publish guard, bulk report, alert reappearance).
- CSRF protection on forms, final validation pass.
- Deployment (Render + MongoDB Atlas) with seeded demo data; docs and checklist finalised.

## Cut if time runs short

Listed up front so scope decisions are deliberate: rich-text lesson content (plain text is enough), email notifications, file attachments on lessons, an admin screen for promoting users to instructor.
