const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const Enrollment = require('../src/models/Enrollment');
const enrollmentService = require('../src/services/enrollmentService');
const { normaliseAddresses, addressesFromText, addressesFromFile } = require('../src/utils/emailList');

describe('bulk enrolment', () => {
  let app;
  let owner;
  let course;
  let alreadyIn;
  let newcomer;

  before(async () => {
    app = await h.setup();
    owner = await h.createInstructor('Bulk Owner');
    alreadyIn = await h.createLearner('Already Here');
    newcomer = await h.createLearner('New Comer');
    ({ course } = await h.createCourse(owner, { title: 'Bulk course' }));
    await enrollmentService.enrolSelf(alreadyIn, course._id);
  });
  after(h.teardown);

  it('reports every address in exactly one category and enrols only the valid ones', async () => {
    const pasted = [
      newcomer.email.toUpperCase(),
      alreadyIn.email,
      'nobody@test.example',
      owner.email,
      'not-an-email',
      newcomer.email, // duplicate in the input
    ].join(', ');

    const report = await enrollmentService.bulkEnrol(
      owner,
      course._id,
      normaliseAddresses(addressesFromText(pasted)),
    );

    const byEmail = Object.fromEntries(report.rows.map((row) => [row.email, row]));
    assert.equal(report.rows.length, 5, 'the duplicate is reported once');
    assert.equal(byEmail[newcomer.email].result, 'enrolled');
    assert.equal(byEmail[newcomer.email].occurrences, 2);
    assert.equal(byEmail[alreadyIn.email].result, 'already_enrolled');
    assert.equal(byEmail['nobody@test.example'].result, 'unknown');
    assert.equal(byEmail[owner.email].result, 'not_learner');
    assert.equal(byEmail['not-an-email'].result, 'invalid');
    assert.deepEqual(report.counts, {
      invalid: 1,
      unknown: 1,
      not_learner: 1,
      already_enrolled: 1,
      enrolled: 1,
    });
    assert.equal(await Enrollment.countDocuments({ course: course._id }), 2);
  });

  it('uses only the email column of a CSV with a header row', () => {
    const csv = 'name,email\n"Doe, Jane",jane@test.example\nJoe,joe@test.example\n';
    assert.deepEqual(addressesFromFile(csv), ['jane@test.example', 'joe@test.example']);
  });

  it('works through the upload form, CSRF token included', async () => {
    const extra = await h.createLearner('Upload Learner');
    const { agent, csrf } = await h.signIn(app, owner);
    const res = await agent
      .post(`/courses/${course._id}/enrollments/bulk`)
      .field('_csrf', csrf)
      .attach('file', Buffer.from(`email\n${extra.email}\n`), 'list.csv');
    assert.equal(res.status, 200);
    assert.match(res.text, /Newly enrolled: 1/);
    assert.equal(await Enrollment.countDocuments({ course: course._id, learner: extra._id }), 1);
  });
});
