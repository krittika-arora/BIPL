# Plan

## How did you break the work into sessions?

- Four days, each ending with the app running and every change committed.
- **Day 1:** setup, login and roles, creating and editing courses, activity log, demo data.
- **Day 2:** lessons, publish/archive rules, enrolment, learner progress, "My learning".
- **Day 3:** course search and filters, bulk enrolment, CSV export, dashboard, comments.
- **Day 4:** inactivity alerts, security (CSRF), automated tests, documentation
- **Day 5:** Final changes, Deployement

## What order did you build in, and why that order?

- **Login and roles first:** every other feature depends on knowing who the user is and what they may do.
- **Courses and lessons next:** enrolment and progress need content to exist.
- **Enrolment and progress after that:** the dashboard, CSV export and alerts all report on progress data.
- **Reporting features later:** search, dashboard and export only make sense once there is data to show.
- **Alerts, security and tests last:** they cover the whole app, so they came once the features were stable.

## What did you estimate versus what it actually took?

| Session                                     | Estimate | Actual       |
|---------------------------------------------|----------|--------------|
| 1. Foundation                               | 4h       |              |
| 2. Lessons, lifecycle, enrolment, progress  | 4h       |              |
| 3. Search, bulk enrolment, CSV, dashboard   | 4h       |              |
| 4. Alerts, security, tests, docs            | 4h       |              |
| **Total**                                   | **16h**  | **~13–14h**  |

- The core features took less time than estimated.
- Extra features added along the way (email verification, forgot password, course ownership, public landing page, clickable dashboard) weren't in the estimate.
- The inactivity alert rule (an alert coming back after a learner goes quiet again) took the most thought.

## What did you cut when you ran short?

- Rich-text lesson content: plain text is enough for now.
- File attachments on lessons.
- An admin screen for creating instructor accounts: they come from the seed instead.
- Email notifications for inactive learners.
- Course ratings, reviews and completion certificates.
