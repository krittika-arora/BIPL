# Submission

## Links

| Item              | Link                                     |
|-------------------|------------------------------------------|
| GitHub repository | https://github.com/krittika-arora/BIPL   |
| Live application  |https://coursetrack-krittika.onrender.com|

## Notes for the reviewer

| #   | Note                                                                                                     |
|-----|----------------------------------------------------------------------------------------------------------|
| 1   | Sign-up sends a real verification code by email.                                                         |
| 2   | Hosted on Render's free tier, so the app sleeps when idle and the first request can take up to a minute. |

## Demo credentials

### Instructors

| Name         | Email                         | Password       |
|--------------|-------------------------------|----------------|
| Ananya Mehta | ananya.instructor@example.com | Instructor@123 |
| Rahul Verma  | rahul.instructor@example.com  | Instructor@123 |

### Learners

| Name          | Email                      | Password    |
|---------------|----------------------------|-------------|
| Neha Kapoor   | neha.learner@example.com   | Learner@123 |
| Arjun Nair    | arjun.learner@example.com  | Learner@123 |
| Sara Iqbal    | sara.learner@example.com   | Learner@123 |
| Vikram Singh  | vikram.learner@example.com | Learner@123 |
| Meera Pillai  | meera.learner@example.com  | Learner@123 |
| Kabir Das     | kabir.learner@example.com  | Learner@123 |
| Priya Raman   | priya.learner@example.com  | Learner@123 |
| Rohan Gupta   | rohan.learner@example.com  | Learner@123 |
| Isha Malhotra | isha.learner@example.com   | Learner@123 |
| Dev Patel     | dev.learner@example.com    | Learner@123 |
| Farah Khan    | farah.learner@example.com  | Learner@123 |
| Leela Menon   | leela.learner@example.com  | Learner@123 |

## Stack

| Layer    | What you used                           | Why                                                           |
|----------|-----------------------------------------|---------------------------------------------------------------|
| Frontend | EJS templates, Bootstrap 5, Chart.js    | Server-rendered pages; simple and responsive.                 |
| Backend  | Node.js, Express 5                      | Lightweight, with clear routes, controllers and services.     |
| Database | MongoDB with Mongoose                   | Flexible documents and aggregations for progress and reports. |
| Hosting  | Render (app) + MongoDB Atlas (database) | Free tiers that suit a Node app and MongoDB.                  |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| #  | Goal                       | Status | Notes                                                                                   |
|----|----------------------------|--------|-----------------------------------------------------------------------------------------|
| 1  | Accounts and roles         | Done   | Email/password login; instructor and learner roles enforced on the server.              |
| 2  | Courses                    | Done   | Create, edit, archive, restore; owners can delete courses nobody has enrolled in.       |
| 3  | Lessons inside courses     | Done   | Add, edit, reorder and remove; shown in order.                                          |
| 4  | Course and progress states | Done   | Draft → Published → Archived; publishing needs a lesson; progress moves automatically.  |
| 5  | Enrollment                 | Done   | Self or instructor enrolment; "My learning" shows every course with progress.           |
| 6  | Finding courses            | Done   | Server-side search, filters, sorting and pagination with total count.                   |
| 7  | Bulk enrollment            | Done   | Per-address report from pasted or uploaded emails; progress CSV export.                 |
| 8  | Dashboard                  | Done   | Headline numbers, breakdowns and an 8-week completions chart.                           |
| 9  | History you cannot rewrite | Done   | Append-only activity log with edits, transitions and comments.                          |
| 10 | Inactivity alerts          | Done   | 14-day alerts with navbar badge; dismissed alerts return after new inactivity.          |

## How much time did you actually spend?

Approximately 13–14 hours spread across multiple development sessions.

## What would you do next, with another 12 hours?

| #   | Next step                                     |
|-----|-----------------------------------------------|
| 1   | Course ratings and reviews.                   |
| 2   | Certificates on completion.                   |
| 3   | Add email notifications for inactive learners |

## What are you least happy with in this codebase, and why?

The seed data's history is created by shifting timestamps after seeding, which is a workaround rather than a clean design.
