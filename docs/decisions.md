# Decisions

## Decision 1:
- **Chose:** Email verification at sign-up: no account until the code is confirmed
- **Rejected:** Creating the account immediately and verifying the email later.
- **Why:** Only verified email addresses become accounts, so fake or mistyped emails never get into the system.

## Decision 2 

- **Chose:** Server Side rendering of EJS frontend
- **Rejected:** React App 
- **Why:** It gives one app to deploy, needs no separate frontend, and keeps all rules on the server.

## Decision 3 

- **Chose:** Instructors can't edit each others courses
- **Rejected:** Any instructor can edit any course.
- **Why:** Each instructor is responsible for their own courses; others can still view progress and export reports.

## Decision 4 

- **Chose:** Learners can unenroll from courses 
- **Rejected:** No learner can unenroll from a couse once enrolled
- **Why:** For cases when they have enrolled in a course by mistake or after pursuing they realise that they dont want to continue it 
- **Later reversed:** Because courses are assigned to employees by the organisation so that they are updated with their skill set which matches with the current industry standards, so it is their obligation to complete the course, not choice. 
**Final decision : Can't Unenroll**

## Decision 5

- **Chose:** Self-registration creates learners only
- **Rejected:** Instructor accounts are provisioned by the seed script (and would be by an admin process in a real deployment).
- **Why:** Allowing a role choice on the sign-up form would let anyone make themselves an instructor.

## Decision 6

- **Chose:** MongoDB
- **Rejected:** MySql
- **Why:** Its flexible documents and aggregation queries suit progress tracking and reports.
