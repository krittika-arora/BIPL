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
