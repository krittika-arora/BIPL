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
| instructor | ObjectId → User | required; the creator and **owner**: only this instructor can change the course or enrol learners (decision 5); indexed |

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
| action | String | `created`, `updated`, `published`, `archived`, `restored`, `lesson_added`, `lesson_updated`, `lesson_removed`, `lesson_moved`, `learner_enrolled`, `learners_bulk_enrolled`, `comment` |
| subject | String | what inside the course it was about (a lesson title), copied so it still reads correctly after a rename or removal |
| message | String | comment text, max 1000; only for `comment` |
| changes | Array of `{ field, from, to }` | only the fields that changed; status changes are recorded as `status: from → to`, moves as `position: from → to` |
| createdAt | Date | set on insert; there is no `updatedAt` because entries never change |

Index: `{ course: 1, createdAt: 1 }`, matching how the log is read (one course's timeline, oldest first; learners see the same timeline filtered to comments).

## How the main screens query this

| Screen | Query |
| --- | --- |
| Course catalogue | One aggregation: `$match` (filters, escaped case-insensitive regex search) then `$facet` returning the requested page and the total count. Enrolment counts come from a `$lookup` with `$count`, run only for the 10 courses on the page unless the sort is by enrolment count. Case-insensitive collation for title order. |
| Dashboard | `countDocuments` for the headline numbers, `$group` aggregations for the breakdowns, and `$dateTrunc` (week, Monday, UTC) for the 8-week chart. |
| Course page roster / CSV | `enrollments` by `course` (uses `{ course, status }`), plus the course's lesson ids to compute %. |

## What breaks first at 100x the data

Today: 14 courses, 65 enrolments. At 100x (about 1,400 courses, 6,500+ enrolments, and an activity log in the tens of thousands of entries):

1. **Catalogue search** breaks first. An unanchored case-insensitive regex cannot use an index, so every search scans all matching courses. At 1,400 courses it still works; well beyond that it gets slow. The fix is a MongoDB text index (or Atlas Search) on title and description, accepting whole-word matching instead of substring matching.
2. **Sorting by enrolment count** runs a `$lookup` for every matching course before sorting. Storing an `enrollmentCount` on the course, updated by the enrolment service, would turn this into a plain indexed sort.
3. **Dashboard aggregations** read the whole `enrollments` collection on each page load. Adding an index on `{ status: 1, completedAt: 1 }` covers the completion queries; beyond that, cache the dashboard for a minute or keep daily totals.
4. **Activity log per course** stays fast because it is indexed by `{ course, createdAt }`, but a very busy course's page would need the log paginated.

## sessions

Managed by `connect-mongo`. Expires after 8 hours via a TTL index.
