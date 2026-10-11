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
