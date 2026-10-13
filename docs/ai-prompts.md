# AI prompts

## Authentication and authorization

### Prompt
- "Add email/password sign-up and login with two roles, instructor and learner, enforced on the server, not just hidden in the UI."
- Later: "Instructors must not be able to edit each other's courses", and "learners can delete only their own account, after entering their password."

### What you got
- Sessions stored in MongoDB, bcrypt password hashes, and `requireRole` checks on every instructor route.
- Sign-up creates learners only; instructor accounts come from the seed.
- An ownership check for course changes, and account deletion that only ever uses the logged-in user.

### What you corrected
- The first version let *any* instructor edit, archive or enrol learners into *any* course. I changed it to owner-only (others can only view and export).

## Frontend

### Prompt
- "Build server-rendered EJS pages with Bootstrap: dashboard, course pages, lessons, My learning."
- Later: "Add a public landing page and catalogue for visitors", "make the dashboard numbers clickable", and "put the Delete button next to Archive."

### What you got
- Shared layout partials (header, navbar, flash, footer), all pages, and a Chart.js completions chart.
- A public landing page, with drafts, archived courses and learner details hidden from visitors.

### What you corrected
- The course page crashed once it had lessons, because a shared section was missing a value it needed. Fixed by passing it in.

## Implement Filters

### Prompt
- "Course catalogue: text search over title and description, filters for category, status and instructor, sorting by title, date or enrolment count, and pagination with the total, all on the server."

### What you got
- One MongoDB aggregation that returns the page and the total count together.
- Only known sort and filter values accepted, and learners always limited to published courses.

### What you corrected
- Enrolment counts were calculated for every course, even though only 10 are shown. Changed to count only the current page.

## Export CSV and log

### Prompt
- "Export every enrolled learner's progress for a course as CSV."
- "Keep an activity log per course (creation, edits, publish/archive, comments) that nobody can edit or delete, including the instructor."

### What you got
- A CSV export (instructors only) and an `ActivityLog` that rejects every update and delete.
- Every change is written to the log by the same function that makes it.

### What you corrected
- A learner named `=HYPERLINK(...)` would turn into a live formula in Excel. Cells starting with `= + - @` are now made safe.

## Generating test cases and testing

### Prompt
- "Generate test cases for roles and permissions, course and progress rules, bulk enrolment, the activity log, inactivity alerts, the catalogue and security, and run them on a separate test database."

### What you got
- 42 automated tests (`npm test`, using `node:test` and `supertest`) that log in through the real forms.
- A separate test database (`MONGODB_URI_TEST`), with emails printed to the console instead of being sent.

### What you corrected
- All tests passed on the first run, so I had some rules deliberately broken (the publish guard, alert reappearance, the owner check) to confirm the tests then fail. They did, and the code was restored.
