// SEED-ONLY. Moves freshly seeded demo data into the past so the dashboard has weeks of
// history to show. It runs straight after `npm run seed` has dropped and rebuilt the
// database, before the app serves anyone. Application code never changes timestamps.
//
// It writes through the raw MongoDB driver (`Model.collection`) because Mongoose treats
// `createdAt` as immutable, and because the activity log's append-only guard (rightly)
// refuses every update made through the model.
const Course = require('../src/models/Course');
const Lesson = require('../src/models/Lesson');
const Enrollment = require('../src/models/Enrollment');
const ActivityLog = require('../src/models/ActivityLog');
const { PROGRESS_STATUS, ACTIVITY_ACTIONS } = require('../src/config/constants');

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

// Small deterministic PRNG so every seed run produces the same demo data.
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random, from, to) {
  return new Date(from.getTime() + random() * Math.max(0, to.getTime() - from.getTime()));
}

// Actions that happened when the course was first built, in their original order.
const SETUP_ACTIONS = [ACTIVITY_ACTIONS.CREATED, ACTIVITY_ACTIONS.LESSON_ADDED, ACTIVITY_ACTIONS.PUBLISHED];

async function setTimestamps(model, id, createdAt, updatedAt = createdAt) {
  const fields = { createdAt };
  if (model !== ActivityLog) fields.updatedAt = updatedAt;
  await model.collection.updateOne({ _id: id }, { $set: fields });
}

// Courses are spread from ~12 weeks ago onwards, oldest first.
// Each course's setup entries, its lessons and its enrolments are placed after that point;
// later edits, archiving and comments stay at "now", where they really happened.
async function spreadHistory({ now = new Date(), seed = 2026 } = {}) {
  const random = createRandom(seed);
  const courses = await Course.find().sort({ createdAt: 1, _id: 1 }).lean();

  for (const [index, course] of courses.entries()) {
    const createdAt = new Date(now.getTime() - (84 - index * 3) * DAY);
    await setTimestamps(Course, course._id, createdAt);

    const setupEntries = await ActivityLog.find({ course: course._id, action: { $in: SETUP_ACTIONS } })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    for (const [step, entry] of setupEntries.entries()) {
      await setTimestamps(ActivityLog, entry._id, new Date(createdAt.getTime() + step * 5 * MINUTE));
    }
    const lessons = await Lesson.find({ course: course._id }).sort({ position: 1 }).lean();
    for (const [step, lesson] of lessons.entries()) {
      await setTimestamps(Lesson, lesson._id, new Date(createdAt.getTime() + (step + 1) * 5 * MINUTE));
    }

    const openedAt = new Date(createdAt.getTime() + DAY);
    const enrollments = await Enrollment.find({ course: course._id }).populate('learner', 'email').lean();
    for (const enrollment of enrollments) {
      let enrolledAt;
      const set = {};
      if (enrollment.status === PROGRESS_STATUS.COMPLETED) {
        const completedAt = between(random, new Date(openedAt.getTime() + DAY), now);
        enrolledAt = between(random, openedAt, new Date(completedAt.getTime() - DAY / 2));
        Object.assign(set, { completedAt, lastActivityAt: completedAt, updatedAt: completedAt });
      } else if (enrollment.status === PROGRESS_STATUS.IN_PROGRESS) {
        // Most made progress recently; about a third have gone quiet for 16-40 days, so the
        // instructors' inactivity alerts have something to show.
        const quiet = random() < 0.35;
        const lastActivityAt = quiet
          ? between(random, new Date(now.getTime() - 40 * DAY), new Date(now.getTime() - 16 * DAY))
          : between(random, new Date(now.getTime() - 10 * DAY), now);
        enrolledAt = between(random, openedAt, new Date(lastActivityAt.getTime() - DAY / 2));
        Object.assign(set, { lastActivityAt, updatedAt: lastActivityAt });
      } else {
        enrolledAt = between(random, new Date(Math.max(openedAt, now.getTime() - 20 * DAY)), now);
        set.updatedAt = enrolledAt;
      }
      await Enrollment.collection.updateOne({ _id: enrollment._id }, { $set: { createdAt: enrolledAt, ...set } });

      // Keep the "instructor enrolled X" log entry in step with the enrolment it describes.
      const enrolledEntry = await ActivityLog.findOne({
        course: course._id,
        action: ACTIVITY_ACTIONS.LEARNER_ENROLLED,
        subject: { $regex: `\\(${enrollment.learner.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)$` },
      }).lean();
      if (enrolledEntry) await setTimestamps(ActivityLog, enrolledEntry._id, enrolledAt);
    }
  }
}

module.exports = { spreadHistory, createRandom };
