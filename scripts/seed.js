// Resets the database and loads demo data. Run with: npm run seed
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const ActivityLog = require('../src/models/ActivityLog');
const courseService = require('../src/services/courseService');
const { ROLES } = require('../src/config/constants');

// Demo-only credentials, documented in SUBMISSION.md.
const INSTRUCTOR_PASSWORD = 'Instructor@123';
const LEARNER_PASSWORD = 'Learner@123';

const INSTRUCTORS = [
  { name: 'Ananya Mehta', email: 'ananya.instructor@example.com' },
  { name: 'Rahul Verma', email: 'rahul.instructor@example.com' },
];

const LEARNERS = [
  { name: 'Neha Kapoor', email: 'neha.learner@example.com' },
  { name: 'Arjun Nair', email: 'arjun.learner@example.com' },
  { name: 'Sara Iqbal', email: 'sara.learner@example.com' },
  { name: 'Vikram Singh', email: 'vikram.learner@example.com' },
  { name: 'Meera Pillai', email: 'meera.learner@example.com' },
  { name: 'Kabir Das', email: 'kabir.learner@example.com' },
];

const COURSES = [
  {
    owner: 0,
    title: 'Workplace Safety Essentials',
    category: 'Compliance',
    description:
      'Mandatory annual safety training: fire exits and evacuation, reporting hazards, first aid points and ergonomic workstation setup.',
  },
  {
    owner: 0,
    title: 'Data Privacy and Information Security',
    category: 'Compliance',
    description:
      'How we handle personal data, classify documents, spot phishing attempts and report a suspected breach.',
  },
  {
    owner: 1,
    title: 'New Joiner Onboarding',
    category: 'Onboarding',
    description:
      'Your first two weeks: company structure, tools and accounts, who to ask for what, and how performance reviews work.',
  },
  {
    owner: 1,
    title: 'Effective Code Reviews',
    category: 'Technical Skills',
    description:
      'Reviewing for correctness first, writing actionable comments, keeping pull requests small, and handling disagreement.',
  },
  {
    owner: 0,
    title: 'Giving Constructive Feedback',
    category: 'Leadership',
    description:
      'A practical framework for specific, timely and kind feedback, with role-play scenarios for first-time managers.',
  },
  {
    owner: 1,
    title: 'Writing Clear Status Updates',
    category: 'Communication',
    description: 'Structure short written updates so readers get the decision, the risk and the ask in the first lines.',
  },
];

async function createUsers(people, role, password) {
  const passwordHash = await User.hashPassword(password);
  return User.insertMany(people.map((person) => ({ ...person, role, passwordHash })));
}

async function seed() {
  if (env.isProduction && process.env.ALLOW_SEED !== 'true') {
    throw new Error('Refusing to reset a production database. Set ALLOW_SEED=true to override.');
  }

  await connectDB(env.mongoUri);

  // A full reset is the one place the activity log is cleared, by dropping the database.
  await mongoose.connection.dropDatabase();
  await Promise.all([User.syncIndexes(), Course.syncIndexes(), ActivityLog.syncIndexes()]);

  const instructors = await createUsers(INSTRUCTORS, ROLES.INSTRUCTOR, INSTRUCTOR_PASSWORD);
  const learners = await createUsers(LEARNERS, ROLES.LEARNER, LEARNER_PASSWORD);

  // Created through the service so each course gets its activity log entries.
  const courses = [];
  for (const { owner, ...data } of COURSES) {
    courses.push(await courseService.createCourse(instructors[owner], data));
  }

  // One edit by the other instructor so the log shows a real change history.
  await courseService.updateCourse(instructors[1], courses[0].id, {
    description: `${courses[0].description} Includes the updated 2026 evacuation map.`,
  });

  console.log(
    `Seeded ${instructors.length} instructors, ${learners.length} learners and ${courses.length} courses.`,
  );
}

seed()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
