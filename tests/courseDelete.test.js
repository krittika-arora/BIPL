const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const ActivityLog = require('../src/models/ActivityLog');
const Course = require('../src/models/Course');
const Lesson = require('../src/models/Lesson');
const enrollmentService = require('../src/services/enrollmentService');

describe('deleting a course', () => {
  let app;
  let owner;
  let otherInstructor;
  let learner;

  before(async () => {
    app = await h.setup();
    owner = await h.createInstructor('Deleting Owner');
    otherInstructor = await h.createInstructor('Not The Owner');
    learner = await h.createLearner('Enrolled Learner');
  });
  after(h.teardown);

  it('lets the owner delete a course nobody has enrolled in, with its lessons, and logs it', async () => {
    const { course } = await h.createCourse(owner, { title: 'Unused course', lessons: 3, publish: false });
    const { post, agent } = await h.signIn(app, owner);

    const res = await post(`/courses/${course._id}/delete`);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/courses');
    assert.match((await agent.get('/courses')).text, /&#34;Unused course&#34; and its lessons have been deleted\./);

    assert.equal(await Course.countDocuments({ _id: course._id }), 0);
    assert.equal(await Lesson.countDocuments({ course: course._id }), 0);
    const entry = await ActivityLog.findOne({ course: course._id, action: 'deleted' }).lean();
    assert.equal(entry.subject, 'Unused course', 'the deletion is kept in the permanent log');
  });

  it('gives another instructor 403 and changes nothing', async () => {
    const { course } = await h.createCourse(owner, { title: 'Someone else\'s', publish: false });
    const { post } = await h.signIn(app, otherInstructor);

    assert.equal((await post(`/courses/${course._id}/delete`)).status, 403);
    assert.equal(await Course.countDocuments({ _id: course._id }), 1);
  });

  it('gives a learner 403', async () => {
    const { course } = await h.createCourse(owner, { title: 'Learner target', publish: false });
    const { post } = await h.signIn(app, learner);
    assert.equal((await post(`/courses/${course._id}/delete`)).status, 403);
    assert.equal(await Course.countDocuments({ _id: course._id }), 1);
  });

  it('refuses to delete a course with enrolments, pointing to archive instead', async () => {
    const { course, lessons } = await h.createCourse(owner, { title: 'Taken course' });
    await enrollmentService.enrolSelf(learner, course._id);
    const { post, agent } = await h.signIn(app, owner);

    const res = await post(`/courses/${course._id}/delete`);
    assert.equal(res.status, 302);
    const page = await agent.get(`/courses/${course._id}`);
    assert.match(page.text, /1 learner has enrolled in this course/);
    assert.match(page.text, /Archive it instead/);
    assert.equal(await Course.countDocuments({ _id: course._id }), 1);
    assert.equal(await Lesson.countDocuments({ course: course._id }), lessons.length);
  });
});
