# AI usage

An AI coding assistant was used during this project. This file records what was asked, what came back, and what was checked or corrected, session by session.

## Session 1

### Prompt: project plan and foundation

Asked for a four-session plan for the training-course tracker on Node/Express/EJS/MongoDB, and for the session 1 code: project structure, sessions-based auth with two roles, course create/edit, an append-only activity log and a seed script.

**What came back:** the plan in `docs/plan.md` and the session 1 code, built one commit at a time.

**What was checked and corrected:**

- **connect-mongo v6 changed its export.** The usual `require('connect-mongo')` returns an object, not the store class, in v6; it has to be `const { MongoStore } = require('connect-mongo')`. Found by inspecting the installed package before wiring sessions.
- **Seed vs. the append-only guard.** Clearing the log with `ActivityLog.deleteMany()` is (correctly) rejected by the immutability middleware, and adding a "seed mode" bypass would weaken it. The seed drops the database and re-syncs indexes instead, so the guard has no exceptions in application code.
- **Immutability had to be proven, not assumed.** Wrote a throwaway script that tried every Mongoose mutation path (`save` on an existing entry, `updateOne`, `updateMany`, `findOneAndUpdate`, `findByIdAndUpdate`, `replaceOne`, `deleteOne`, `deleteMany`, `findByIdAndDelete`, document `deleteOne`/`updateOne`, `bulkWrite`); all were rejected and the entry was unchanged. The raw-driver gap is written up in decision 7.
- **Role checks verified from the outside.** Signed in as a learner and requested instructor URLs directly (`GET /courses/new`, `GET` and `POST /courses/:id/edit`, `POST /courses`): all 403. A draft course URL returns 404 to learners, so its existence is not leaked.

## Session 2

### Prompt: lessons, lifecycle, enrolment and progress

Gave the assistant the session 2 brief: a Lesson model with reorderable positions, a single `transitionCourse` function driven by an explicit transition map with a publish-needs-a-lesson guard, an Enrollment model with self and instructor enrolment, a single progress service, a "My learning" page, activity-log entries for every lesson change and transition, and a seed that exercises all of it. Each piece was built and checked in the running app before its commit.

**What was checked and corrected:**

- **The course page crashed after lessons were added.** The `_lessons` partial used `isInstructor`, which is a variable declared inside `show.ejs`, not a render local, so including the partial threw `isInstructor is not defined` (a 500). Caught by requesting the course page after creating lessons; fixed by passing it explicitly with `include('_lessons', { isInstructor })`.
- **A rejection message disappeared.** When a learner who was not enrolled tried to complete a lesson, the service correctly refused, but the controller redirected back to the lesson page, which itself redirects non-enrolled learners to the course page. The flash message was consumed by the middle request and never shown. Changed rule-violation redirects to go straight to the course page.
- **Instructors got a bare 404.** Enrolling a learner into a draft course reused the learner-facing "published course only" lookup, so an instructor (who *can* see drafts) got "Course not found". Changed it to a specific message: "Learners can only be enrolled in a published course." Learners still get 404 for unpublished courses, so drafts stay invisible to them.
- **A learner could get stuck in progress.** Reviewing the remove-lesson path showed that a learner who had completed every other lesson would stay `in_progress` forever once the last outstanding lesson was deleted. Added `progressService.reconcileCourse()` and verified it: a learner with 2 of 3 lessons done moved to `completed` when the third was removed (decision 12).
- **Unique index on lesson positions rejected.** A unique `(course, position)` index looked like the obvious way to guarantee ordering, but swapping two lessons would collide on the first update. Kept a plain index and made the service responsible for contiguity (decision 14).
- **Wording in a generated message.** The transition error read "A archived course cannot be moved…". Reworded to "This archived course cannot be moved…".

**How the rules were verified:** with seeded data, signed in as a learner and called every instructor-only route directly (course create/edit/status, lesson add/edit/delete/move, enrol-by-email): all 403. Draft and archived course pages: 404 for learners. Learner-only routes (enrol, complete lesson, My learning) called as an instructor: 403. Illegal transitions (`published → draft`, `draft → archived`, publishing an empty course, an unknown status) were all refused with a message, the stored status was unchanged, and no activity entry was written.

## Session 3

### Prompt: catalogue, bulk enrolment, export, dashboard and comments

Gave the assistant the session 3 brief: server-side search, filters, sorting and pagination in one aggregation; bulk enrolment from pasted or uploaded lists with a per-address report; a per-course CSV export; a dashboard with headline numbers, breakdowns and an 8-week chart; comments on the activity log; and seed data with history spread over recent weeks. Each part was built and checked in the running app before its commit.

**What was checked and corrected:**

- **The JSON escaping for the chart broke the server.** The first version of the helper that embeds chart data in the page wrote the Unicode line-separator escapes into the source file as the raw characters themselves. A raw line separator inside a regex literal is a syntax error, so the app would not start. The `<` escape in the same helper had also collapsed to a plain `<`, which would have left the `</script>` hole open. Caught by running the helper on a hostile string (`</script><script>alert(1)</script>` plus a line separator). Rewritten so the pattern is built from character codes, then re-checked: no `<` and no raw separators in the output, and the data parses back unchanged.
- **Testing mistakes that looked like app bugs.** Three times a check failed because of the test, not the code: curl treats `[ ]` in URLs as glob patterns, `curl -F` treats `;` in a value as an option separator, and a helper cut its own output at 150 characters. Each was confirmed against the server before moving on (e.g. the bulk list was re-sent with `--form-string`), so no code was changed to "fix" a problem the app did not have.
- **A misleading name.** A service helper was named `getCourseOpenForEnrolmentOrNull`, but it never returns null: it throws a 404. Renamed to `getCourseForBulkForm`.
- **Enrolment counts for every course.** Counting enrolments with a `$lookup` before pagination did the work for every matching course just to show 10. Changed so the lookup runs only for the current page, except when sorting by enrolment count, where it is needed for the sort (decision 17).
- **Seed history vs. append-only guarantees.** Spreading demo history over past weeks means changing timestamps, which the app itself must never do. The step was kept out of the application, in a clearly marked seed-only file that runs right after the database reset, and documented as decision 22 with the consistency checks it passed.

**How it was verified:** search and filters against hand-picked expectations, including operator-injection attempts (`q[$regex]=.*`, `instructor[$ne]=x`), which were treated as plain values. Pagination: every course appears exactly once across pages, and an out-of-range page redirects to the last one. Bulk enrolment: a mixed list producing all five outcomes, a duplicate address, a `name,email` CSV with a quoted comma, wrong file type, a file over 100 KB, 501 addresses, a draft course, and a learner calling the endpoint (403). CSV export: a learner registered as `=HYPERLINK("http://evil","Click, me")`, and the exported cell came out defused and correctly quoted (9 columns on every row). Dashboard: every headline number matched an independent count in `mongosh`, and the week boundaries (Sunday 23:59 / Monday 00:00 UTC, and the edge of the 8-week window) were tested with backdated completions. The chart was checked through its embedded data and the table fallback, not visually in a browser.

### Follow-up: course ownership (my decision, implemented with the assistant)

While reviewing the app as an instructor, I asked how instructors could edit each other's courses. Decision 5 allowed exactly that, and I decided it was wrong for this scenario. I wrote the permission table myself (view, progress, enrolment details and CSV export allowed on a colleague's course; editing, lessons, publish/archive and enrolling not allowed) and asked the assistant to enforce it.

**What came back and was checked:** one ownership check in `src/utils/ownership.js`, called inside the service functions that load a course for changing, rather than in each route. Signed in as Rahul and tried every action on Ananya's course: viewing, progress and export returned 200; edit form and submit, publish, archive, add/edit/move/remove lesson, single and bulk enrolment (form and submit) all returned 403, and the course, its lessons and its enrolments were unchanged afterwards. Both instructors could still do everything on their own courses.

**Correction this forced:** the seed had one instructor editing the other's course description to give the log some history. That now (correctly) fails, so the seed makes that edit as the course's owner.

### Follow-up: public landing page and catalogue (my requirement, implemented with the assistant)

I asked for a public side to the app: a landing page with the platform name, navigation, a hero ("Learn new skills. Track your growth."), featured courses, benefits and login/register buttons, plus a public catalogue of published courses with search, filters, sorting, pagination, instructor names and enrolment counts. Drafts and archived courses must stay hidden, and nothing sensitive should show.

**What came back and was checked:** instead of a separate public code path, the existing visibility rule was extended so a visitor is treated like a learner (published only), and the course page renders a visitor version. Verified signed out: catalogue and course pages work, `?status=draft` is ignored, draft and archived course pages return 404, and the page source contains no emails, roster, progress, comments, lesson content or lesson links. Every protected page and every POST redirects to login and writes nothing. Signed-in instructors and learners see exactly what they did before.

**Something added that I had not asked for:** returning visitors to the page they wanted after logging in. Because that takes a URL from the query string, it was checked against open-redirect tricks (decision 24).

### Follow-up: email verification with OTP (my requirement, implemented with the assistant)

I asked for sign-ups to be verified with a one-time code sent by email, configurable with my own SMTP details, plus instructions for setting them up.

**What came back:** a two-step sign-up (pending sign-up, then account creation after the code), SMTP settings from environment variables with a console fallback in development only, an `npm run mail:test` command, and `docs/email-setup.md` with Gmail App Password steps and other providers.

**What was checked and corrected:**

- **Verified over real SMTP, not just the console.** A small local SMTP server, accepting one username/password, was used to check the whole path: login, delivery, the email's sender/recipient/subject, a rejected password, an unreachable port, and production refusing to start without `SMTP_HOST`.
- **The first test run was invalid.** My own `npm run dev` server was still running on port 3000, so the test server could not bind and the requests went to my server, which had no SMTP configured. The odd results (no emails received, a "development mode" notice) gave it away. The assistant identified the processes, stopped only its own leftover test server, and reran everything on a separate port and a separate test database, so it no longer touched my running app or data.
- **14 sign-up scenarios** passed after that:
  - the code is never stored in plain text, and no user exists before verification;
  - a wrong code shows the attempts left, and badly formatted input does not use up an attempt;
  - resend is blocked inside 60 seconds and invalidates the old code;
  - expired codes are refused, and a code typed with a space is accepted;
  - the new account is a learner who can log in with their password;
  - a duplicate email is refused, the fifth wrong code cancels the sign-up, the post-login return path is kept, and the send limit holds even when the form is restarted;
  - an SMTP outage shows a clear message and allows an immediate retry.

### Follow-up: clickable dashboard numbers (my requirement, implemented with the assistant)

I asked for the four headline numbers on the instructor dashboard to be clickable and show the list behind each one.

**What was checked and corrected:**

- **Two of the four lists failed on the first run.** The helper that joins in learner names and course titles had lost the `$` in front of the field name while being written, so MongoDB received the plain word `learner` instead of the field path `$learner` and rejected the query. The test run surfaced the error; the helper now builds the path as `'$' + field`.
- **A grouping bug caught before it shipped.** The in-progress list first replaced the learner id it groups by with the learner's details, which would have merged two deleted learners into one row. Changed to keep the id and put the details in a separate field.
- **Numbers verified against the database:** every list total equals its tile (12, 12, 4, 10 on the seed data). Neha's row (7 enrolled: 3 / 2 / 2) matches a direct count. All 24 in-progress percentages match an independent calculation with the app's own progress function. Pagination was checked with 42 learners (20 + 20 + 2, page 99 redirects to page 3). Learners get 403 and visitors are sent to log in. Tests ran on a separate port and test database, not on my running app.
