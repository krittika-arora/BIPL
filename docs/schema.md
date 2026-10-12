# Data model

MongoDB via Mongoose. All collections have `createdAt`; mutable ones also have `updatedAt`.

## User (`users`)

| Field | Type | Rules |
| --- | --- | --- |
| name | String | required, max 80 |
| email | String | required, unique index, stored lowercase |
| passwordHash | String | bcrypt, 12 rounds; the plain password is never stored |
| role | String | `instructor` or `learner`, default `learner` |

## Course (`courses`)

| Field | Type | Rules |
| --- | --- | --- |
| title | String | required, max 120 |
| description | String | required, max 2000 |
| category | String | one of the fixed categories in `src/config/constants.js` |
| status | String | `draft`, `published`, `archived`; default `draft`; indexed |
| instructor | ObjectId → User | required; the creator; indexed |

## Lesson (`lessons`)

| Field | Type | Rules |
| --- | --- | --- |
| course | ObjectId → Course | required; a lesson belongs to exactly one course |
| title | String | required, max 120 |
| content | String | required, max 10,000; plain text |
| position | Number | 1-based running order; kept contiguous (1..n) by `lessonService` |

Index: `{ course: 1, position: 1 }`, deliberately **not unique** (see decision 14).

## Enrollment (`enrollments`)

One row per learner per course. Progress lives here, so it is tracked separately for every learner on every course.

| Field | Type | Rules |
| --- | --- | --- |
| learner | ObjectId → User | required |
| course | ObjectId → Course | required |
| enrolledBy | ObjectId → User | the learner (self-enrolment) or the instructor who enrolled them |
| status | String | `not_started`, `in_progress`, `completed`; default `not_started`; only changed by `progressService` |
| completedLessons | ObjectId[] → Lesson | lessons this learner has completed; added atomically with `$addToSet` |
| lastActivityAt | Date or null | set on every progress action; null until the learner starts. Will drive inactivity alerts |
| completedAt | Date or null | set when status becomes `completed` |

Indexes: `{ learner: 1, course: 1 }` **unique** (no double enrolment, even under concurrent requests); `{ course: 1, status: 1 }` for roster and reporting queries.

Progress % is derived, not stored: lessons in `completedLessons` that still exist in the course, divided by the course's current lesson count (`src/utils/progress.js`).

## ActivityLog (`activitylogs`)

Append-only. See decision 7 in `decisions.md` for how this is enforced.

| Field | Type | Rules |
| --- | --- | --- |
| course | ObjectId → Course | required |
| actor | ObjectId → User | required; who did it |
| action | String | `created`, `updated`, `published`, `archived`, `restored`, `lesson_added`, `lesson_updated`, `lesson_removed`, `lesson_moved` |
| subject | String | what inside the course it was about (a lesson title), copied so it still reads correctly after a rename or removal |
| changes | Array of `{ field, from, to }` | only the fields that changed; status changes are recorded as `status: from → to`, moves as `position: from → to` |
| createdAt | Date | set on insert; there is no `updatedAt` because entries never change |

Index: `{ course: 1, createdAt: 1 }`, matching the only query (one course's timeline, oldest first).

## sessions

Managed by `connect-mongo`. Expires after 8 hours via a TTL index.
