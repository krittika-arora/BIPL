const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const Course = require('../src/models/Course');

describe('course catalogue', () => {
  let app;

  before(async () => {
    app = await h.setup();
    const owner = await h.createInstructor('Catalogue Owner');
    // 23 published courses and 2 drafts. Created directly: the catalogue only reads them.
    const docs = [];
    for (let i = 1; i <= 25; i += 1) {
      docs.push({
        title: `Course ${String(i).padStart(2, '0')}`,
        description: i % 5 === 0 ? 'Covers data privacy' : 'General skills',
        category: i % 2 ? 'Compliance' : 'Leadership',
        status: i > 23 ? 'draft' : 'published',
        instructor: owner._id,
      });
    }
    await Course.insertMany(docs);
  });
  after(h.teardown);

  const titles = (html) => [...html.matchAll(/fw-semibold text-decoration-none">([^<]+)</g)].map((m) => m[1]);
  const total = (html) => Number((html.match(/<strong>(\d+)<\/strong> courses? found/) || [])[1]);

  it('shows the total number of matches and pages of 10, with no overlaps', async () => {
    const pages = await Promise.all([1, 2, 3].map((p) => h.request(app).get(`/courses?page=${p}&sort=title&dir=asc`)));
    assert.equal(total(pages[0].text), 23, 'visitors see published courses only');
    const all = pages.flatMap((page) => titles(page.text));
    assert.equal(all.length, 23);
    assert.equal(new Set(all).size, 23, 'every course appears exactly once');
    assert.equal(all[0], 'Course 01');
  });

  it('searches and filters on the server, and ignores a status filter from non-instructors', async () => {
    const search = await h.request(app).get('/courses?q=PRIVACY');
    assert.equal(total(search.text), 4); // 5, 10, 15, 20 (25 is a draft)
    const filtered = await h.request(app).get('/courses?category=Leadership&status=draft');
    assert.equal(total(filtered.text), 11);
    assert.ok(titles(filtered.text).every((t) => Number(t.slice(-2)) <= 23));
  });

  it('redirects a page past the end to the last page', async () => {
    const res = await h.request(app).get('/courses?page=99');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/courses?page=3');
  });
});
