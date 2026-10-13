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

## Layers

| Layer | Folder | Responsibility |
| --- | --- | --- |
| Routes | `src/routes/` | Map URLs to controllers. Apply `requireAuth`, `requireRole`, validation rules, and the upload middleware. |
| Controllers | `src/controllers/` | Read the request, call one service, choose a view or redirect, turn rule violations (409) into flash messages or 422 re-renders. No database access. |
| Services | `src/services/` | All business rules and every write: transitions, ownership, progress, enrolment, alerts, logging to the activity log. The only code that changes data. |
| Models | `src/models/` | Mongoose schemas, indexes, and the activity log's append-only guard. |
| Middleware | `src/middleware/` | Loading the user, role checks, CSRF, security headers, flash messages, the alert badge, errors. |
| Utils | `src/utils/` | Pure helpers: progress maths, CSV writing, query parsing, one-time codes, ownership check. |
| Views | `views/` | EJS templates. `partials/` holds the shared header, navbar, flash and footer. |

Because every write goes through a service, a new route cannot skip a rule or forget to log: the rule lives in the one function that makes the change (decisions 6, 9 and 10).

## Middleware order (src/app.js)

1. **Security headers**, then **static files**, then **body parsing** (form posts, 100 KB limit).
2. **Session.** The cookie holds only a session id; data is in MongoDB.
3. **Flash messages.**
4. **`loadCurrentUser`.** Loads the signed-in user, and ends sessions that signed in before a password reset.
5. **`currentPath`** for the navbar.
6. **CSRF protection.** Every non-GET request must carry the session's token; file uploads are checked inside their route once the form is parsed.
7. **Alert badge.** For instructors' page views, one count query for the navbar badge.
8. **Routes.** Then 404, then the error handler, which never shows internal details for server errors.

## Request path for one action: a learner completes a lesson

`POST /courses/:courseId/lessons/:lessonId/complete`

1. **Session and user.** The session cookie is looked up in MongoDB; `loadCurrentUser` loads the learner.
2. **CSRF.** The `_csrf` field must equal the session's token, or the request stops with 403.
3. **Routing.** `routes/courses.js` sends `/:courseId/lessons` through `requireAuth` to `routes/lessons.js`, where `requireRole(LEARNER)` allows learners only (instructors get 403).
4. **Controller.** `lessonController.complete` calls `progressService.completeLesson(req.user, courseId, lessonId)`. The learner comes from the session, never from the form.
5. **Service.** `progressService.completeLesson`:
   - checks that the course exists and is published, the learner is enrolled, the lesson belongs to the course, and the course is not already completed;
   - atomically adds the lesson to `completedLessons` and sets `lastActivityAt`, refusing if it was already there (so a double click cannot count twice);
   - works out the new status by walking the transition map (`not_started → in_progress → completed`) and saves it only if the status has not changed in the meantime.
6. **Response.** Success redirects to the next lesson with a flash message, or to the course page with "Course completed". A rule violation redirects back with a warning.
7. **Side effects.** The changed `lastActivityAt` automatically clears any inactivity alert for this enrolment. An earlier dismissal no longer matches, so if the learner goes quiet for 14 days again the alert returns (decision 29). Nothing else needs updating.

## Where to find things

| Feature | Start here |
| --- | --- |
| Course lifecycle and publish guard | `services/courseService.transitionCourse` |
| Lessons and ordering | `services/lessonService` |
| Enrolment (self, single, bulk) and CSV export | `services/enrollmentService`, `utils/emailList`, `utils/csv` |
| Progress | `services/progressService`, `utils/progress` |
| Catalogue | `services/courseService.listCourses`, `utils/catalogueQuery` |
| Dashboard and drill-down lists | `services/dashboardService` |
| Activity log and comments | `models/ActivityLog`, `services/activityService` |
| Inactivity alerts | `services/alertService`, `models/AlertDismissal`, `middleware/alertBadge` |
| Sign-up verification, password reset | `services/signupService`, `services/passwordResetService`, `utils/oneTimeCode`, `services/mailService` |
| Account deletion | `services/accountService` |
| Permissions | `middleware/auth` (roles), `utils/ownership` (course owner), `middleware/csrf` |
