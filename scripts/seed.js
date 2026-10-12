// Resets the database and loads demo data. Run with: npm run seed
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Lesson = require('../src/models/Lesson');
const Enrollment = require('../src/models/Enrollment');
const ActivityLog = require('../src/models/ActivityLog');
const courseService = require('../src/services/courseService');
const lessonService = require('../src/services/lessonService');
const enrollmentService = require('../src/services/enrollmentService');
const progressService = require('../src/services/progressService');
const { ROLES, COURSE_STATUS } = require('../src/config/constants');

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

// finalStatus: what the course ends up as. enrolments: [learnerIndex, lessonsCompleted, how].
// lessonsCompleted 'all' finishes the course; 'self' or 'instructor' says who enrolled them.
const COURSES = [
  {
    owner: 0,
    title: 'Workplace Safety Essentials',
    category: 'Compliance',
    description:
      'Mandatory annual safety training: fire exits and evacuation, reporting hazards, first aid points and ergonomic workstation setup.',
    lessons: [
      ['Why safety training is mandatory', 'Every employee completes this course once a year. It covers the legal duties we share and what to do in the first minutes of an incident.'],
      ['Fire exits and evacuation', 'Know the two nearest exits from your desk.\nOn the alarm, leave immediately by the nearest safe exit, do not use lifts, and go to the assembly point in the car park.'],
      ['Reporting hazards', 'Spills, trailing cables, blocked exits and broken equipment are reported through the facilities form the same day. You do not need to fix it yourself.'],
      ['Setting up your workstation', 'Top of the screen at eye level, forearms level with the desk, feet flat. Take a short break from the screen every hour.'],
    ],
    finalStatus: COURSE_STATUS.PUBLISHED,
    enrolments: [[0, 'all', 'self'], [1, 2, 'self'], [2, 1, 'self'], [3, 0, 'instructor'], [4, 'all', 'instructor']],
  },
  {
    owner: 0,
    title: 'Data Privacy and Information Security',
    category: 'Compliance',
    description:
      'How we handle personal data, classify documents, spot phishing attempts and report a suspected breach.',
    lessons: [
      ['What counts as personal data', 'Names, emails, phone numbers, employee IDs and anything that can identify a person, alone or combined with other data.'],
      ['Classifying documents', 'Public, Internal, Confidential, Restricted. When unsure, pick the higher level and ask your manager.'],
      ['Spotting phishing', 'Check the sender domain, hover before clicking, and be suspicious of urgency. Report anything odd with the "Report phishing" button.'],
      ['Reporting a suspected breach', 'Report within one hour to the security team, even if you are not sure. Do not try to investigate on your own.'],
    ],
    finalStatus: COURSE_STATUS.PUBLISHED,
    enrolments: [[0, 1, 'self'], [5, 'all', 'self'], [2, 0, 'instructor'], [1, 'all', 'self']],
  },
  {
    owner: 1,
    title: 'New Joiner Onboarding',
    category: 'Onboarding',
    description:
      'Your first two weeks: company structure, tools and accounts, who to ask for what, and how performance reviews work.',
    lessons: [
      ['Welcome and how we are organised', 'An overview of our teams, who leads them, and how product, engineering and operations work together.'],
      ['Accounts and tools', 'Set up email, chat, the HR portal and two-factor authentication on day one. IT support is on the #it-help channel.'],
      ['Who to ask for what', 'Your manager for priorities, your onboarding buddy for everyday questions, HR for contracts and leave.'],
      ['Your first 30 days', 'Meet your team, ship one small change, and agree your first goals with your manager by the end of week four.'],
      ['How performance reviews work', 'Reviews happen twice a year. They are based on agreed goals and peer feedback, with no surprises.'],
    ],
    finalStatus: COURSE_STATUS.PUBLISHED,
    enrolments: [[5, 3, 'instructor'], [4, 2, 'self'], [3, 'all', 'instructor'], [0, 0, 'self']],
  },
  {
    owner: 1,
    title: 'Effective Code Reviews',
    category: 'Technical Skills',
    description:
      'Reviewing for correctness first, writing actionable comments, keeping pull requests small, and handling disagreement.',
    lessons: [
      ['What a review is for', 'Catch defects, share knowledge and keep the codebase consistent, in that order. Style nits come last.'],
      ['Writing actionable comments', 'Say what is wrong, why it matters and what you would suggest. Mark optional comments clearly.'],
      ['Handling disagreement', 'Move long threads to a short call, then write the outcome back on the pull request.'],
    ],
    finalStatus: COURSE_STATUS.PUBLISHED,
    enrolments: [[1, 1, 'self'], [3, 0, 'instructor']],
  },
  {
    owner: 0,
    title: 'Giving Constructive Feedback',
    category: 'Leadership',
    description:
      'A practical framework for specific, timely and kind feedback, with role-play scenarios for first-time managers.',
    lessons: [
      ['Why feedback gets avoided', 'Most people delay feedback to avoid discomfort, which makes the eventual conversation harder.'],
      ['The situation, behaviour, impact model', 'Describe the situation, the specific behaviour you saw, and its impact. Then ask for their view.'],
      ['Role-play scenarios', 'Three short scenarios to practise with a partner, from a missed deadline to an interrupted meeting.'],
    ],
    finalStatus: COURSE_STATUS.DRAFT,
    enrolments: [],
  },
  {
    owner: 1,
    title: 'Writing Clear Status Updates',
    category: 'Communication',
    description: 'Structure short written updates so readers get the decision, the risk and the ask in the first lines.',
    lessons: [
      ['Lead with the point', 'Put the decision or the ask in the first sentence. Background goes after.'],
      ['Red, amber, green done right', 'A status colour needs one line saying why, and what would change it.'],
      ['A template you can reuse', 'Summary, progress since last update, risks, asks. Four headings, five lines each at most.'],
    ],
    // Published, used, then archived: shows that archiving keeps lessons and enrolments.
    finalStatus: COURSE_STATUS.ARCHIVED,
    enrolments: [[0, 1, 'self'], [4, 'all', 'self']],
  },
];

async function createUsers(people, role, password) {
  const passwordHash = await User.hashPassword(password);
  return User.insertMany(people.map((person) => ({ ...person, role, passwordHash })));
}

async function enrolAndProgress(course, lessons, instructor, learner, completed, how) {
  if (how === 'instructor') {
    await enrollmentService.enrolByEmail(instructor, course._id, learner.email);
  } else {
    await enrollmentService.enrolSelf(learner, course._id);
  }
  const count = completed === 'all' ? lessons.length : completed;
  for (const lesson of lessons.slice(0, count)) {
    await progressService.completeLesson(learner, course._id, lesson._id);
  }
}

async function seed() {
  if (env.isProduction && process.env.ALLOW_SEED !== 'true') {
    throw new Error('Refusing to reset a production database. Set ALLOW_SEED=true to override.');
  }

  await connectDB(env.mongoUri);

  // A full reset is the one place the activity log is cleared, by dropping the database.
  await mongoose.connection.dropDatabase();
  await Promise.all(
    [User, Course, Lesson, Enrollment, ActivityLog].map((model) => model.syncIndexes()),
  );

  const instructors = await createUsers(INSTRUCTORS, ROLES.INSTRUCTOR, INSTRUCTOR_PASSWORD);
  const learners = await createUsers(LEARNERS, ROLES.LEARNER, LEARNER_PASSWORD);

  // Everything below goes through the services, so the activity log and progress rules apply.
  for (const { owner, lessons, finalStatus, enrolments, ...data } of COURSES) {
    const instructor = instructors[owner];
    const course = await courseService.createCourse(instructor, data);

    const created = [];
    for (const [title, content] of lessons) {
      const { lesson } = await lessonService.addLesson(instructor, course._id, { title, content });
      created.push(lesson);
    }
    if (finalStatus === COURSE_STATUS.DRAFT) continue;

    await courseService.transitionCourse(instructor, course._id, COURSE_STATUS.PUBLISHED);
    for (const [learnerIndex, completed, how] of enrolments) {
      await enrolAndProgress(course, created, instructor, learners[learnerIndex], completed, how);
    }
    if (finalStatus === COURSE_STATUS.ARCHIVED) {
      await courseService.transitionCourse(instructor, course._id, COURSE_STATUS.ARCHIVED);
    }
  }

  // A few later edits so activity logs show more than creation.
  const safety = await Course.findOne({ title: 'Workplace Safety Essentials' });
  await courseService.updateCourse(instructors[1], safety._id, {
    description: `${safety.description} Includes the updated 2026 evacuation map.`,
  });
  const onboarding = await Course.findOne({ title: 'New Joiner Onboarding' });
  const whoToAsk = await Lesson.findOne({ course: onboarding._id, title: 'Who to ask for what' });
  await lessonService.moveLesson(instructors[1], onboarding._id, whoToAsk._id, 'up');

  const [courseCount, lessonCount, enrollmentCount, byStatus] = await Promise.all([
    Course.countDocuments(),
    Lesson.countDocuments(),
    Enrollment.countDocuments(),
    Enrollment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const statusSummary = byStatus.map(({ _id, count }) => `${_id}: ${count}`).join(', ');
  console.log(
    `Seeded ${instructors.length} instructors, ${learners.length} learners, ${courseCount} courses, ` +
      `${lessonCount} lessons and ${enrollmentCount} enrolments (${statusSummary}).`,
  );
}

seed()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
