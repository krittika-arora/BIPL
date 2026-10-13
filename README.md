# CourseTrack

An internal training platform. Instructors build and publish courses made of ordered lessons; learners enrol and work through them at their own pace; progress is tracked automatically, so instructors can see who has finished, who is partway through and who has gone quiet.

**Stack:** Node.js + Express 5, EJS server-rendered views, Bootstrap 5, MongoDB with Mongoose, sessions stored in MongoDB. Chart.js (from a CDN) draws the dashboard chart; multer reads uploaded email lists.

## Running locally

Requirements: Node.js 20.12 or newer, and MongoDB (local install or an Atlas connection string).

```bash
npm install
cp .env.example .env      # then set MONGODB_URI and SESSION_SECRET
npm run seed              # resets the database and loads demo data
npm run dev               # http://localhost:3000, restarts on file changes
npm test                  # 38 tests against MONGODB_URI_TEST (a separate database)
```

`npm start` runs without file watching (used in production). `npm run mail:test -- you@example.com` checks your SMTP settings by sending one test email.

### Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `SESSION_SECRET` | yes | Signs the session cookie. Use a long random string |
| `MONGODB_URI_TEST` | for `npm test` | Separate database for the tests, which delete it; the name must contain "test" |
| `PORT` | no | Defaults to 3000 |
| `NODE_ENV` | no | `production` enables secure cookies and proxy trust, and makes SMTP settings required |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | in production | Outgoing email for sign-up verification codes. In development, leave `SMTP_HOST` empty and the email is printed in the terminal instead. Step-by-step setup: [docs/email-setup.md](docs/email-setup.md) |

The app refuses to start if a required variable is missing; there are no hardcoded fallbacks. `.env` is git-ignored.

Demo accounts are listed in [SUBMISSION.md](SUBMISSION.md).

## Project structure

```
index.js                 entry point: load config, connect to MongoDB, start server
src/
  app.js                 Express app: views, sessions, middleware, routes
  config/                env loading, DB connection, shared constants
  models/                Mongoose schemas
  services/              business rules; every write goes through here
  controllers/           request handling and view rendering
  routes/                URL to controller mapping, auth and role guards
  validators/            express-validator rules for each form
  middleware/            auth, flash messages, error handling
  utils/                 small helpers
views/                   EJS templates (partials/ holds the shared layout)
public/                  static CSS
scripts/seed.js          demo data (scripts/seedHistory.js spreads it over past weeks)
tests/                   node:test + supertest suite (npm test)
docs/                    plan, decisions, schema, AI usage
```

## Documentation

- [docs/architecture.md](docs/architecture.md): how a request flows through the app, and where each feature lives
- [docs/plan.md](docs/plan.md): build plan by session
- [docs/decisions.md](docs/decisions.md): design decisions and trade-offs
- [docs/schema.md](docs/schema.md): data model
- [docs/ai-prompts.md](docs/ai-prompts.md): how AI assistance was used and what was corrected
