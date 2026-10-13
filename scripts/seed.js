// Resets the database and loads demo data. Run with: npm run seed
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Lesson = require('../src/models/Lesson');
const Enrollment = require('../src/models/Enrollment');
const ActivityLog = require('../src/models/ActivityLog');
const AlertDismissal = require('../src/models/AlertDismissal');
const PendingSignup = require('../src/models/PendingSignup');
const PasswordReset = require('../src/models/PasswordReset');
const courseService = require('../src/services/courseService');
const lessonService = require('../src/services/lessonService');
const enrollmentService = require('../src/services/enrollmentService');
const progressService = require('../src/services/progressService');
const activityService = require('../src/services/activityService');
const { spreadHistory, createRandom } = require('./seedHistory');
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
  { name: 'Priya Raman', email: 'priya.learner@example.com' },
  { name: 'Rohan Gupta', email: 'rohan.learner@example.com' },
  { name: 'Isha Malhotra', email: 'isha.learner@example.com' },
  { name: 'Dev Patel', email: 'dev.learner@example.com' },
  { name: 'Farah Khan', email: 'farah.learner@example.com' },
  { name: 'Leela Menon', email: 'leela.learner@example.com' },
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

// Smaller published courses whose enrolments are generated, so the catalogue has
// more than one page and the dashboard has enough completions to chart.
const EXTRA_COURSES = [
  ['Inclusive Meetings', 'Communication', 0, 'Run meetings where everyone can contribute: agendas, turn-taking and follow-ups.',
    ['Send the agenda early', 'Make room for quieter voices', 'Close with owners and dates']],
  ['Anti-Bribery and Gifts Policy', 'Compliance', 0, 'What you may accept, what you must declare, and how to report a concern.',
    ['What counts as a bribe', 'Gifts and hospitality limits', 'How to declare and report']],
  ['Git Fundamentals', 'Technical Skills', 1, 'Branches, commits and pull requests for people new to version control.',
    ['Commits and history', 'Branching and merging', 'Opening a pull request']],
  ['Running Effective One-to-Ones', 'Leadership', 0, 'A simple weekly structure that keeps one-to-ones useful for both sides.',
    ['Whose meeting is it?', 'A reusable agenda', 'Following up']],
  ['Expense Claims and Travel', 'Onboarding', 1, 'How to book travel, what you can claim and how to submit receipts.',
    ['Booking travel', 'What you can claim', 'Submitting a claim']],
  ['Writing Good Bug Reports', 'Technical Skills', 1, 'Reports that get fixed: steps to reproduce, expected versus actual, and evidence.',
    ['Steps to reproduce', 'Expected and actual', 'Screenshots and logs']],
  ['Presenting with Confidence', 'Communication', 1, 'Structure a short talk, handle questions and manage nerves.',
    ['One message per talk', 'Handling questions', 'Managing nerves']],
  ['Delegation for New Managers', 'Leadership', 0, 'Decide what to hand over, brief it clearly and check in without micromanaging.',
    ['What to delegate', 'Briefing the task', 'Checking in']],
].map(([title, category, owner, description, lessonTitles]) => ({
  owner,
  title,
  category,
  description,
  lessons: lessonTitles.map((lessonTitle) => [
    lessonTitle,
    `${lessonTitle}: key points, a short example from our own teams, and one thing to try this week.`,
  ]),
  finalStatus: COURSE_STATUS.PUBLISHED,
  enrolments: null, // generated
}));

// Picks 4-8 learners for a course with a deterministic mix of progress.
function generateEnrolments(random, learnerCount, lessonCount) {
  const picked = new Set();
  const target = 4 + Math.floor(random() * 5);
  while (picked.size < Math.min(target, learnerCount)) picked.add(Math.floor(random() * learnerCount));
  return [...picked].map((learnerIndex) => {
    const roll = random();
    const completed = roll < 0.45 ? 'all' : roll < 0.8 ? 1 + Math.floor(random() * (lessonCount - 1)) : 0;
    return [learnerIndex, completed, random() < 0.5 ? 'self' : 'instructor'];
  });
}

const COMMENTS = [
  ['Workplace Safety Essentials', 'learner', 0, 'Is the assembly point still the car park now the new wing is open?'],
  ['Workplace Safety Essentials', 'instructor', 0, 'Yes. The updated map in lesson 2 shows the route from the new wing.'],
  ['Data Privacy and Information Security', 'learner', 1, 'The phishing examples were really useful. Could we get a printable checklist?'],
  ['New Joiner Onboarding', 'instructor', 1, 'Moved "Who to ask for what" earlier after feedback from the last intake.'],
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
    [User, Course, Lesson, Enrollment, ActivityLog, AlertDismissal, PendingSignup, PasswordReset].map(
      (model) => model.syncIndexes(),
    ),
  );

  const instructors = await createUsers(INSTRUCTORS, ROLES.INSTRUCTOR, INSTRUCTOR_PASSWORD);
  const learners = await createUsers(LEARNERS, ROLES.LEARNER, LEARNER_PASSWORD);

  // Everything below goes through the services, so the activity log and progress rules apply.
  const random = createRandom(42);
  for (const { owner, lessons, finalStatus, enrolments: listed, ...data } of [...COURSES, ...EXTRA_COURSES]) {
    const enrolments = listed || generateEnrolments(random, learners.length, lessons.length);
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
  await courseService.updateCourse(instructors[0], safety._id, {
    description: `${safety.description} Includes the updated 2026 evacuation map.`,
  });
  const onboarding = await Course.findOne({ title: 'New Joiner Onboarding' });
  const whoToAsk = await Lesson.findOne({ course: onboarding._id, title: 'Who to ask for what' });
  await lessonService.moveLesson(instructors[1], onboarding._id, whoToAsk._id, 'up');

  for (const [courseTitle, role, index, message] of COMMENTS) {
    const course = await Course.findOne({ title: courseTitle });
    const author = role === 'instructor' ? instructors[index] : learners[index];
    await activityService.addComment(author, course._id, message);
  }

  await spreadHistory();

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
