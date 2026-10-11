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

## ActivityLog (`activitylogs`)

Append-only. See decision 7 in `decisions.md` for how this is enforced.

| Field | Type | Rules |
| --- | --- | --- |
| course | ObjectId → Course | required |
| actor | ObjectId → User | required; who did it |
| action | String | `created`, `updated` (extended as features land) |
| changes | Array of `{ field, from, to }` | for edits: only the fields that changed |
| createdAt | Date | set on insert; there is no `updatedAt` because entries never change |

Index: `{ course: 1, createdAt: 1 }`, matching the only query (one course's timeline, oldest first).

## sessions

Managed by `connect-mongo`. Expires after 8 hours via a TTL index.
