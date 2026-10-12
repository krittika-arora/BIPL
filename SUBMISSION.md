# Submission: CourseTrack

**Assignment:** Internal training: courses, lessons and learner progress tracking
**Repository:** https://github.com/krittika-arora/BIPL
**Live application:** not deployed yet (planned for session 4)

## Without logging in

Open the app without signing in to see the public side: a landing page (platform name, hero, featured courses, benefits, log in / register), the course catalogue with search, filters, sorting and pagination, and course pages with descriptions and lesson titles. Only published courses appear. Drafts, archived courses, lesson content, learner details, progress and comments are never shown to visitors (decision 23). "Log in to enrol" brings people back to the course after they sign in (decision 24).

## Demo credentials

Created by `npm run seed`. These are demo-only accounts.

| Role | Email | Password |
| --- | --- | --- |
| Instructor | ananya.instructor@example.com | Instructor@123 |
| Instructor | rahul.instructor@example.com | Instructor@123 |
| Learner | neha.learner@example.com | Learner@123 |
| Learner | arjun.learner@example.com | Learner@123 |
| Learner | sara.learner@example.com | Learner@123 |
| Learner | vikram.learner@example.com | Learner@123 |
| Learner | meera.learner@example.com | Learner@123 |
| Learner | kabir.learner@example.com | Learner@123 |
| Learner | priya.learner@example.com | Learner@123 |
| Learner | rohan.learner@example.com | Learner@123 |
| Learner | isha.learner@example.com | Learner@123 |
| Learner | dev.learner@example.com | Learner@123 |
| Learner | farah.learner@example.com | Learner@123 |
| Learner | leela.learner@example.com | Learner@123 |

New sign-ups through `/register` are always learners, and must confirm their email with a 6-digit code before the account is created. **When running locally without SMTP settings, the code is printed in the terminal running `npm run dev`**; to send real emails, see [docs/email-setup.md](docs/email-setup.md). The demo accounts above already exist and do not need verifying.

The seed creates 14 courses (12 published, 1 draft, 1 archived with its enrolments kept), 46 lessons and 65 enrolments in every progress state, with completions spread over the last eight weeks and a few comments. `neha.learner@example.com` is a good learner account to start with; it has courses in every state.

## Goal checklist

Status reflects what works in the code today, not what is planned.

| # | Goal | Status | Notes |
| --- | --- | --- | --- |
| 1 | Accounts and roles | Done | Email/password sign-in; instructor and learner roles. Every instructor action (course and lesson edits, transitions, enrolling others) is guarded on the server: learners get 403. Learners get 404 on draft/archived course pages, can only enrol themselves, only act on their own enrolment, and never see the learner roster. Instructors cannot use learner-only actions (403). Instructors can view, track and export any course, but only a course's own instructor can edit it, change its lessons, publish/archive it or enrol learners into it; anyone else gets 403 (decision 5). |
| 2 | Courses | Done | Create and edit (title, description, category). Archive and restore; archiving hides the course from learners but keeps its lessons and every enrolment, which still shows under My learning as "Archived". |
| 3 | Lessons | Done | Each lesson belongs to one course, with title, content and position. Add, edit, remove, move up/down; positions stay 1..n. The course page lists lessons in order. Lessons of an archived course are frozen; the last lesson of a published course cannot be removed. |
| 4 | Course and progress states | Done | Course moves go through one service with an explicit map (draft→published→archived, archived→published as restore); anything else is rejected with a message. Publishing with no lessons is rejected: "A course needs at least one lesson before it can be published." Progress (not started→in progress→completed) is changed only by completing lessons, through one service that also rejects completing a lesson twice, progress on a finished or unpublished course, and lessons from another course. |
| 5 | Enrollment | Done | Learners self-enrol in published courses; instructors enrol a learner by email (unknown address, instructor accounts, duplicates and unpublished courses are refused with a reason). Unique index on learner+course. "My learning" lists every enrolment with status and % progress. |
| 6 | Finding courses | Done | One MongoDB aggregation does text search (title and description), filters (category; status for instructors only; instructor), sorting (title, created date, enrolment count; either direction) and pagination (10 per page) with the total match count. Learners only ever get published courses, whatever the URL says. Query values are whitelisted; filters survive pagination. |
| 7 | Bulk enrollment and CSV export | Done | Paste addresses and/or upload a .csv/.txt. Each address is reported once as newly enrolled, already enrolled, unknown address, not a learner account, or invalid email; valid rows succeed even when others fail. Per-course progress CSV export (instructors only) with escaping and spreadsheet-formula protection. |
| 8 | Dashboard | Done | Total learners, published courses, completions this month, learners currently in progress; enrolments by progress state and by course; a bar chart of completions per week for the last eight weeks (Monday-based, UTC, empty weeks shown as zero). All computed by MongoDB on the server. Learners get their own summary instead. |
| 9 | Activity log | Done | Append-only log records creation, every course edit (field, old value, new value), publish/archive/restore, lesson added/edited/removed/moved, instructor enrolments, and comments, each with who and when. Rejected actions leave no entry. Learners enrolled in a course can read and add comments; instructors see the full log. No entry can be edited or deleted. |
| 10 | Inactivity alerts | Not started | |
