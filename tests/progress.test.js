const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const Enrollment = require('../src/models/Enrollment');
const enrollmentService = require('../src/services/enrollmentService');
const progressService = require('../src/services/progressService');
const lessonService = require('../src/services/lessonService');
const HttpError = require('../src/utils/httpError');

const isRuleViolation = (pattern) => (err) => HttpError.isRuleViolation(err) && pattern.test(err.message);

describe('learner progress', () => {
  let owner;

  before(async () => {
    await h.setup();
    owner = await h.createInstructor('Progress Owner');
  });
  after(h.teardown);

  it('moves not started → in progress → completed only when every lesson is done', async () => {
    const learner = await h.createLearner('Steady Learner');
    const { course, lessons } = await h.createCourse(owner, { title: 'Three lessons', lessons: 3 });
    await enrollmentService.enrolSelf(learner, course._id);

    const statusAfter = async () => (await Enrollment.findOne({ learner: learner._id }).lean()).status;
    assert.equal(await statusAfter(), 'not_started');

    await progressService.completeLesson(learner, course._id, lessons[2]._id); // out of order is fine
    assert.equal(await statusAfter(), 'in_progress');
    await progressService.completeLesson(learner, course._id, lessons[0]._id);
    assert.equal(await statusAfter(), 'in_progress');
    await progressService.completeLesson(learner, course._id, lessons[1]._id);
    assert.equal(await statusAfter(), 'completed');

    const enrollment = await Enrollment.findOne({ learner: learner._id }).lean();
    assert.ok(enrollment.completedAt, 'completedAt is set');
    assert.ok(enrollment.lastActivityAt, 'lastActivityAt is set');
  });

  it('rejects illegal progress moves', async () => {
    const learner = await h.createLearner('Eager Learner');
    const { course, lessons } = await h.createCourse(owner, { title: 'Two lessons', lessons: 2 });
    const { lessons: otherLessons } = await h.createCourse(owner, { title: 'Other' });

    await assert.rejects(
      progressService.completeLesson(learner, course._id, lessons[0]._id),
      isRuleViolation(/not enrolled/),
    );

    await enrollmentService.enrolSelf(learner, course._id);
    await progressService.completeLesson(learner, course._id, lessons[0]._id);
    await assert.rejects(
      progressService.completeLesson(learner, course._id, lessons[0]._id),
      isRuleViolation(/already completed this lesson/),
    );
    await assert.rejects(
      progressService.completeLesson(learner, course._id, otherLessons[0]._id),
      (err) => err.status === 404,
    );

    await progressService.completeLesson(learner, course._id, lessons[1]._id);
    await assert.rejects(
      progressService.completeLesson(learner, course._id, lessons[1]._id),
      isRuleViolation(/already completed this course/),
    );
  });

  it('completes a learner who finished every remaining lesson after one is removed', async () => {
    const learner = await h.createLearner('Nearly Done');
    const { course, lessons } = await h.createCourse(owner, { title: 'Shrinking', lessons: 3 });
    await enrollmentService.enrolSelf(learner, course._id);
    await progressService.completeLesson(learner, course._id, lessons[0]._id);
    await progressService.completeLesson(learner, course._id, lessons[1]._id);

    await lessonService.removeLesson(owner, course._id, lessons[2]._id);
    const enrollment = await Enrollment.findOne({ learner: learner._id }).lean();
    assert.equal(enrollment.status, 'completed');
  });
});
