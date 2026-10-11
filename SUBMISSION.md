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
| 1 | Accounts and roles | Partial | Email/password sign-in, instructor and learner roles, server-side role checks on every course route (learners get 403 on instructor URLs, 404 on unpublished courses). Enrolment permissions arrive with goal 5. |
| 2 | Courses | Partial | Create and edit with title, description, category. Archive/restore not built yet. |
| 3 | Lessons | Not started | |
| 4 | Course and progress states | Not started | Courses are stored as `draft`; transitions not built yet. |
| 5 | Enrollment | Not started | |
| 6 | Finding courses | Not started | A plain list exists; search, filters, sorting and pagination not built yet. |
| 7 | Bulk enrollment and CSV export | Not started | |
| 8 | Dashboard | Not started | |
| 9 | Activity log | Partial | Append-only log records course creation and every edit (field, old value, new value, who, when). Publish/archive events and comments not built yet. |
| 10 | Inactivity alerts | Not started | |
