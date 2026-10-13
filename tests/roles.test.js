const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const Course = require('../src/models/Course');

describe('roles and ownership are enforced on the server', () => {
  let app;
  let owner;
  let otherInstructor;
  let learner;
  let course;
  let lessons;
  let draft;

  before(async () => {
    app = await h.setup();
    owner = await h.createInstructor('Owner Instructor');
    otherInstructor = await h.createInstructor('Other Instructor');
    learner = await h.createLearner('Plain Learner');
    ({ course, lessons } = await h.createCourse(owner, { title: 'Owned course' }));
    ({ course: draft } = await h.createCourse(owner, { title: 'Draft course', publish: false }));
  });
  after(h.teardown);

  it('gives a learner 403 on every instructor page and action', async () => {
    const { agent, post } = await h.signIn(app, learner);
    const id = course._id;
    const lessonId = lessons[0]._id;

    for (const url of ['/courses/new', `/courses/${id}/edit`, `/courses/${id}/lessons/new`,
      `/courses/${id}/progress.csv`, `/courses/${id}/enrollments/bulk`, '/alerts',
      '/dashboard/learners']) {
      const res = await agent.get(url);
      assert.equal(res.status, 403, `GET ${url}`);
    }
    const posts = [
      ['/courses', { title: 'x', description: 'y', category: 'Compliance' }],
      [`/courses/${id}/edit`, { title: 'x', description: 'y', category: 'Compliance' }],
      [`/courses/${id}/status`, { to: 'archived' }],
      [`/courses/${id}/lessons`, { title: 'x', content: 'y' }],
      [`/courses/${id}/lessons/${lessonId}/delete`, {}],
      [`/courses/${id}/lessons/${lessonId}/move`, { direction: 'down' }],
      [`/courses/${id}/enrollments`, { email: 'someone@test.example' }],
    ];
    for (const [url, data] of posts) {
      const res = await post(url, data);
      assert.equal(res.status, 403, `POST ${url}`);
    }

    const unchanged = await Course.findById(id).lean();
    assert.equal(unchanged.status, 'published');
    assert.equal(unchanged.title, 'Owned course');
  });

  it('hides draft courses from learners (404)', async () => {
    const { agent } = await h.signIn(app, learner);
    const res = await agent.get(`/courses/${draft._id}`);
    assert.equal(res.status, 404);
  });

  it('gives another instructor 403 on changes, but lets them view and export', async () => {
    const { agent, post } = await h.signIn(app, otherInstructor);
    assert.equal((await agent.get(`/courses/${course._id}`)).status, 200);
    assert.equal((await agent.get(`/courses/${course._id}/progress.csv`)).status, 200);
    assert.equal((await agent.get(`/courses/${course._id}/edit`)).status, 403);
    assert.equal((await post(`/courses/${course._id}/status`, { to: 'archived' })).status, 403);
    assert.equal(
      (await post(`/courses/${course._id}/lessons`, { title: 'x', content: 'y' })).status,
      403,
    );
  });

  it('sends visitors to the login page for protected pages', async () => {
    const res = await h.request(app).get('/my-learning');
    assert.equal(res.status, 302);
    assert.match(res.headers.location, /^\/login/);
  });
});
