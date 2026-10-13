# Architecture

CourseTrack is a single server-rendered Node.js application: Express 5 renders EJS templates, and MongoDB (through Mongoose) stores everything, including sessions. There is no separate front-end app and no background job. The only browser scripts are Bootstrap's and the dashboard chart.

```
Browser ──HTTP──> Express app ───────────────────────────────> MongoDB
                   │                                            users, courses, lessons,
                   ├─ static files (public/)                    enrollments, activitylogs,
                   ├─ session (cookie ↔ sessions collection)    alertdismissals, pendingsignups,
                   ├─ middleware (user, CSRF, alert badge)      passwordresets, sessions
                   ├─ routes → controllers → services → models
                   └─ EJS views (views/)          services/mailService ──SMTP──> mail server
```

## What are the moving pieces, and how do they talk to each other?

- **Browser:** shows server-rendered HTML pages; sends form posts and page requests over HTTP.
- **Express app (Node.js):** the only server. Routes → controllers → services → models.
  - **Middleware:** loads the logged-in user, checks the CSRF token, and counts alerts for the navbar.
  - **Services:** hold all business rules and are the only code that changes data.
- **MongoDB:** stores all data, including sessions. The app talks to it through Mongoose.
- **Mail server (SMTP):** the app sends sign-up and password-reset codes through it with Nodemailer.
- **CDN:** the browser loads Bootstrap and Chart.js from it directly.

## Where does each piece run?

| Piece | Runs on |
|-------|---------|
| Express app | Render (web service) |
| MongoDB | MongoDB Atlas (cloud database) |
| Mail server | Gmail SMTP (configured with environment variables) |
| Pages and chart | The user's browser |
| Bootstrap, Chart.js | Public CDN (jsDelivr) |

- Locally, the same app runs with `npm run dev` against a local MongoDB.

## What is the request path for one representative user action, end to end?

**A learner clicks "Mark as complete" on a lesson** (`POST /courses/:courseId/lessons/:lessonId/complete`):

1. **Browser** submits the form with the CSRF token.
2. **Session:** the cookie is looked up in MongoDB and the learner is loaded.
3. **CSRF check:** the token must match the session's token, otherwise 403.
4. **Route:** only logged-in learners are allowed; instructors get 403.
5. **Controller:** calls the progress service with the learner from the session, never from the form.
6. **Service:**
   - checks the course is published, the learner is enrolled, and the lesson belongs to the course;
   - adds the lesson to `completedLessons` in one atomic update, so a double click can't count twice;
   - moves the status `not_started → in_progress → completed` when every lesson is done;
   - updates `lastActivityAt`, which also clears any inactivity alert.
7. **Response:** redirects to the next lesson with a "Lesson marked as complete" message, or to the course page when the course is finished.

## What did you decide *not* to build, and why?

- **A separate React frontend:** server-rendered pages are simpler and keep all rules on the server.
- **A REST/JSON API:** no other client needs one.
- **Background jobs:** alerts are computed when the page loads, so nothing needs to run on a timer.
- **Unenrolling from a course:** courses are assigned by the organisation and must be completed.
- **An admin screen for instructor accounts:** instructors come from the seed for now.
- **Email notifications for inactive learners, certificates, ratings:** left for later; the core goals came first.
