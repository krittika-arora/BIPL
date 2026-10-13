const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const AlertDismissal = require('../src/models/AlertDismissal');
const Enrollment = require('../src/models/Enrollment');
const alertService = require('../src/services/alertService');
const enrollmentService = require('../src/services/enrollmentService');
const progressService = require('../src/services/progressService');

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY);

describe('inactivity alerts', () => {
  let app;
  let owner;
  let otherInstructor;
  let learner;
  let course;
  let lessons;
  let enrollment;

  // Puts the learner's last progress at a given time (as if no activity happened since).
  const setLastActivity = (date) =>
    Enrollment.updateOne({ _id: enrollment._id }, { $set: { lastActivityAt: date } });
  const isAlerting = async (now = new Date()) => {
    const { rows } = await alertService.listOpenAlerts(owner._id, 1, now);
    return rows.some((row) => String(row.enrollmentId) === String(enrollment._id));
  };

  before(async () => {
    app = await h.setup();
    owner = await h.createInstructor('Alert Owner');
    otherInstructor = await h.createInstructor('Alert Bystander');
    learner = await h.createLearner('Quiet Learner');
    ({ course, lessons } = await h.createCourse(owner, { title: 'Alert course', lessons: 3 }));
    await enrollmentService.enrolSelf(learner, course._id);
    await progressService.completeLesson(learner, course._id, lessons[0]._id); // now in progress
    enrollment = await Enrollment.findOne({ learner: learner._id });
  });
  after(h.teardown);

  it('raises no alert at 14 days or less, and an alert after more than 14 days', async () => {
    await setLastActivity(daysAgo(13));
    assert.equal(await isAlerting(), false, '13 days');
    await setLastActivity(new Date(Date.now() - 14 * DAY + 60 * 1000));
    assert.equal(await isAlerting(), false, 'just under 14 days');
    await setLastActivity(daysAgo(15));
    assert.equal(await isAlerting(), true, '15 days');
    assert.equal(await alertService.countOpenAlerts(owner._id), 1);
  });

  it('only alerts the course owner, and not for not-started learners', async () => {
    assert.equal(await alertService.countOpenAlerts(otherInstructor._id), 0);
    const idle = await h.createLearner('Never Started');
    await enrollmentService.enrolSelf(idle, course._id);
    await Enrollment.updateOne({ learner: idle._id }, { $set: { createdAt: daysAgo(40) } });
    assert.equal(await alertService.countOpenAlerts(owner._id), 1);
  });

  it('hides the alert once dismissed, for as long as the learner stays quiet', async () => {
    await setLastActivity(daysAgo(20));
    await alertService.dismissAlert(owner, enrollment._id);
    assert.equal(await isAlerting(), false);
    assert.equal(await isAlerting(new Date(Date.now() + 30 * DAY)), false, 'still quiet a month later');
  });

  it('brings the alert back after renewed activity and another 14 quiet days, with nothing reset', async () => {
    const dismissalsBefore = await AlertDismissal.find({ enrollment: enrollment._id }).lean();

    await progressService.completeLesson(learner, course._id, lessons[1]._id); // engages again
    const { lastActivityAt } = await Enrollment.findById(enrollment._id).lean();
    assert.equal(await isAlerting(), false, 'active again: no alert');

    const fifteenDaysLater = new Date(lastActivityAt.getTime() + 15 * DAY);
    assert.equal(await isAlerting(fifteenDaysLater), true, 'quiet for 15 more days: alert is back');

    const dismissalsAfter = await AlertDismissal.find({ enrollment: enrollment._id }).lean();
    assert.deepEqual(dismissalsAfter, dismissalsBefore, 'the old dismissal was never touched');
  });

  it('lets only the owner dismiss, through the app', async () => {
    await setLastActivity(daysAgo(25)); // a new quiet spell (different lastActivityAt)
    const other = await h.signIn(app, otherInstructor);
    assert.equal((await other.post(`/alerts/${enrollment._id}/dismiss`)).status, 403);

    const learnerSession = await h.signIn(app, learner);
    assert.equal((await learnerSession.agent.get('/alerts')).status, 403);

    const ownerSession = await h.signIn(app, owner);
    const page = await ownerSession.agent.get('/alerts');
    assert.match(page.text, /Quiet Learner/);
    assert.match(page.text, /badge rounded-pill text-bg-warning ms-1">1</, 'navbar badge shows 1');
    assert.equal((await ownerSession.post(`/alerts/${enrollment._id}/dismiss`)).status, 302);
    assert.equal(await isAlerting(), false);
  });
});
