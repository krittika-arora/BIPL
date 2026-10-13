// Shared test setup. Must be required before anything from src/, because it points the app at
// the test database and forces emails to the console before the config is loaded.
try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const testUri = process.env.MONGODB_URI_TEST;
if (!testUri) {
  throw new Error('Set MONGODB_URI_TEST (e.g. mongodb://127.0.0.1:27017/coursetrack_test) to run tests.');
}
// The suite drops this database, so refuse anything that does not look like a test database.
const dbName = (testUri.split('?')[0].match(/\/([^/]+)$/) || [])[1] || '';
if (!/test/i.test(dbName)) {
  throw new Error(`MONGODB_URI_TEST must name a database containing "test" (got "${dbName}").`);
}
process.env.MONGODB_URI = testUri;
process.env.NODE_ENV = 'test';
process.env.MAIL_TRANSPORT = 'console';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-not-for-production';

const mongoose = require('mongoose');
const request = require('supertest');
const createApp = require('../src/app');
const User = require('../src/models/User');
const courseService = require('../src/services/courseService');
const lessonService = require('../src/services/lessonService');
const { ROLES, COURSE_STATUS } = require('../src/config/constants');

const PASSWORD = 'Testing123';

async function setup() {
  await mongoose.connect(testUri);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  return createApp();
}

async function teardown() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

// bcrypt's cost makes hashing slow, so every test user shares one precomputed hash.
let passwordHash;
async function createUser(name, role) {
  passwordHash = passwordHash || (await User.hashPassword(PASSWORD));
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@test.example`;
  return User.create({ name, email, role, passwordHash });
}

const createInstructor = (name) => createUser(name, ROLES.INSTRUCTOR);
const createLearner = (name) => createUser(name, ROLES.LEARNER);

// A course created through the real services (so it is logged), with lessons, optionally published.
async function createCourse(owner, { title = 'Test course', lessons = 2, publish = true } = {}) {
  const course = await courseService.createCourse(owner, {
    title,
    description: `${title} description`,
    category: 'Compliance',
  });
  const lessonDocs = [];
  for (let i = 1; i <= lessons; i += 1) {
    const { lesson } = await lessonService.addLesson(owner, course._id, {
      title: `Lesson ${i}`,
      content: `Content ${i}`,
    });
    lessonDocs.push(lesson);
  }
  if (publish) await courseService.transitionCourse(owner, course._id, COURSE_STATUS.PUBLISHED);
  return { course, lessons: lessonDocs };
}

function tokenFrom(html) {
  const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  return match ? match[1] : null;
}

// Signs in through the real login form (CSRF token included) and returns an agent that keeps the
// session cookie, plus a helper that submits forms with the session's CSRF token.
async function signIn(app, user) {
  const agent = request.agent(app);
  const loginPage = await agent.get('/login');
  const response = await agent
    .post('/login')
    .type('form')
    .send({ _csrf: tokenFrom(loginPage.text), email: user.email, password: PASSWORD });
  if (response.status !== 302 || response.headers.location !== '/') {
    throw new Error(`Login failed for ${user.email} (${response.status})`);
  }
  const home = await agent.get('/');
  const csrf = tokenFrom(home.text);
  const post = (url, data = {}) => agent.post(url).type('form').send({ _csrf: csrf, ...data });
  return { agent, post, csrf };
}

module.exports = {
  PASSWORD,
  setup,
  teardown,
  createInstructor,
  createLearner,
  createCourse,
  signIn,
  tokenFrom,
  request,
};
