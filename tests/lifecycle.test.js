const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const Course = require('../src/models/Course');
const ActivityLog = require('../src/models/ActivityLog');
const courseService = require('../src/services/courseService');
const HttpError = require('../src/utils/httpError');

const isRuleViolation = (pattern) => (err) => HttpError.isRuleViolation(err) && pattern.test(err.message);

describe('course lifecycle', () => {
  let app;
  let owner;

  before(async () => {
    app = await h.setup();
    owner = await h.createInstructor('Lifecycle Owner');
  });
  after(h.teardown);

  it('rejects publishing a course with no lessons, and changes nothing', async () => {
    const { course } = await h.createCourse(owner, { title: 'Empty', lessons: 0, publish: false });
    const logBefore = await ActivityLog.countDocuments({ course: course._id });

    await assert.rejects(
      courseService.transitionCourse(owner, course._id, 'published'),
      isRuleViolation(/at least one lesson before it can be published/),
    );

    const after = await Course.findById(course._id).lean();
    assert.equal(after.status, 'draft');
    assert.equal(await ActivityLog.countDocuments({ course: course._id }), logBefore);
  });

  it('shows the publish-guard message through the app', async () => {
    const { course } = await h.createCourse(owner, { title: 'Empty 2', lessons: 0, publish: false });
    const { agent, post } = await h.signIn(app, owner);
    const res = await post(`/courses/${course._id}/status`, { to: 'published' });
    assert.equal(res.status, 302);
    const page = await agent.get(`/courses/${course._id}`);
    assert.match(page.text, /A course needs at least one lesson before it can be published\./);
    assert.equal((await Course.findById(course._id).lean()).status, 'draft');
  });

  it('rejects every move that is not in the transition map', async () => {
    const { course: draft } = await h.createCourse(owner, { title: 'Draft', publish: false });
    await assert.rejects(
      courseService.transitionCourse(owner, draft._id, 'archived'),
      isRuleViolation(/draft course cannot be moved to archived/),
    );

    const { course: published } = await h.createCourse(owner, { title: 'Published' });
    await assert.rejects(
      courseService.transitionCourse(owner, published._id, 'draft'),
      isRuleViolation(/cannot be moved to draft/),
    );
    await assert.rejects(
      courseService.transitionCourse(owner, published._id, 'deleted'),
      isRuleViolation(/is not a course status/),
    );
  });

  it('allows draft → published → archived → published (restore), logging each step', async () => {
    const { course } = await h.createCourse(owner, { title: 'Full cycle', publish: false });
    await courseService.transitionCourse(owner, course._id, 'published');
    await courseService.transitionCourse(owner, course._id, 'archived');
    await courseService.transitionCourse(owner, course._id, 'published');

    assert.equal((await Course.findById(course._id).lean()).status, 'published');
    const actions = (await ActivityLog.find({ course: course._id }).sort({ createdAt: 1, _id: 1 }).lean())
      .map((entry) => entry.action)
      .filter((action) => ['published', 'archived', 'restored'].includes(action));
    assert.deepEqual(actions, ['published', 'archived', 'restored']);
  });
});
