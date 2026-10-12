# Submission: CourseTrack

**Assignment:** Internal training: courses, lessons and learner progress tracking
**Repository:** https://github.com/krittika-arora/BIPL
**Live application:** not deployed yet (planned for session 4)

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

New sign-ups through `/register` are always learners.

## Goal checklist

Status reflects what works in the code today, not what is planned.

| # | Goal | Status | Notes |
| --- | --- | --- | --- |
| 1 | Accounts and roles | Done | Email/password sign-in; instructor and learner roles. Every instructor action (course and lesson edits, transitions, enrolling others) is guarded on the server: learners get 403. Learners get 404 on draft/archived course pages, can only enrol themselves, only act on their own enrolment, and never see the learner roster. Instructors cannot use learner-only actions (403). |
| 2 | Courses | Done | Create and edit (title, description, category). Archive and restore; archiving hides the course from learners but keeps its lessons and every enrolment, which still shows under My learning as "Archived". |
| 3 | Lessons | Done | Each lesson belongs to one course, with title, content and position. Add, edit, remove, move up/down; positions stay 1..n. The course page lists lessons in order. Lessons of an archived course are frozen; the last lesson of a published course cannot be removed. |
| 4 | Course and progress states | Done | Course moves go through one service with an explicit map (draft→published→archived, archived→published as restore); anything else is rejected with a message. Publishing with no lessons is rejected: "A course needs at least one lesson before it can be published." Progress (not started→in progress→completed) is changed only by completing lessons, through one service that also rejects completing a lesson twice, progress on a finished or unpublished course, and lessons from another course. |
| 5 | Enrollment | Done | Learners self-enrol in published courses; instructors enrol a learner by email (unknown address, instructor accounts, duplicates and unpublished courses are refused with a reason). Unique index on learner+course. "My learning" lists every enrolment with status and % progress. |
| 6 | Finding courses | Not started | A plain list exists; search, filters, sorting and pagination not built yet. |
| 7 | Bulk enrollment and CSV export | Not started | |
| 8 | Dashboard | Not started | |
| 9 | Activity log | Partial | Append-only log records creation, every course edit (field, old value, new value), publish/archive/restore, and lesson added/edited/removed/moved, each with who and when. Rejected actions leave no entry. Comments not built yet. |
| 10 | Inactivity alerts | Not started | |
