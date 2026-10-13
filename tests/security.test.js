const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const User = require('../src/models/User');
const PasswordReset = require('../src/models/PasswordReset');
const { errorHandler } = require('../src/middleware/errors');

describe('security', () => {
  let app;
  let learner;
  let otherLearner;

  before(async () => {
    app = await h.setup();
    learner = await h.createLearner('Secure Learner');
    otherLearner = await h.createLearner('Other Learner');
  });
  after(h.teardown);

  it('rejects form posts without a valid CSRF token', async () => {
    const noToken = await h.request(app)
      .post('/login')
      .type('form')
      .send({ email: learner.email, password: h.PASSWORD });
    assert.equal(noToken.status, 403);

    const { agent, csrf } = await h.signIn(app, learner);
    const wrongToken = await agent.post('/logout').type('form').send({ _csrf: `${csrf.slice(0, -1)}0` });
    assert.equal(wrongToken.status, 403);
    const rightToken = await agent.post('/logout').type('form').send({ _csrf: csrf });
    assert.equal(rightToken.status, 302);
  });

  it('sends protective headers and hides the framework', async () => {
    const res = await h.request(app).get('/');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  it('never shows internal error details or stack traces', () => {
    let rendered;
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      render(view, locals) {
        rendered = { view, ...locals };
      },
    };
    const originalError = console.error;
    console.error = () => {}; // the handler logs server errors; keep test output clean
    try {
      errorHandler(new Error('connection string mongodb://secret@db failed'), {}, res, () => {});
    } finally {
      console.error = originalError;
    }
    assert.equal(res.code, 500);
    assert.equal(rendered.message, 'Something went wrong on our side. Please try again.');
    assert.ok(!JSON.stringify(rendered).includes('mongodb://'));
    assert.ok(!JSON.stringify(rendered).includes('at '), 'no stack trace');
  });

  it('lets learners delete only their own account, and only with their password', async () => {
    const { post } = await h.signIn(app, learner);
    const wrong = await post('/account/delete', { password: 'Wrong1234', confirm: 'yes' });
    assert.equal(wrong.status, 422);

    const smuggled = await post('/account/delete', {
      password: h.PASSWORD,
      confirm: 'yes',
      userId: String(otherLearner._id),
      _id: String(otherLearner._id),
    });
    assert.equal(smuggled.status, 302);
    assert.equal(await User.countDocuments({ _id: learner._id }), 0, 'own account deleted');
    assert.equal(await User.countDocuments({ _id: otherLearner._id }), 1, 'other account untouched');
  });

  it('answers a password reset request the same way for known and unknown emails', async () => {
    const ask = async (email) => {
      const agent = h.request.agent(app);
      const page = await agent.get('/forgot-password');
      const res = await agent
        .post('/forgot-password')
        .type('form')
        .send({ _csrf: h.tokenFrom(page.text), email });
      const next = await agent.get('/forgot-password/reset');
      return { status: res.status, location: res.headers.location, page: next.text.replace(/[a-z]{2}\*+@test\.example/g, 'MASKED') };
    };
    const known = await ask(otherLearner.email);
    const unknown = await ask('nobody.here@test.example');
    assert.equal(known.status, unknown.status);
    assert.equal(known.location, unknown.location);
    assert.equal(
      known.page.replace(/value="[a-f0-9]{64}"/g, ''),
      unknown.page.replace(/value="[a-f0-9]{64}"/g, ''),
    );
    assert.equal(await PasswordReset.countDocuments({ email: otherLearner.email }), 1);
    assert.equal(await PasswordReset.countDocuments({ email: 'nobody.here@test.example' }), 0);
  });
});
