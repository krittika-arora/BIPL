const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const ActivityLog = require('../src/models/ActivityLog');

describe('activity log is append-only', () => {
  let entry;

  before(async () => {
    await h.setup();
    const owner = await h.createInstructor('Log Owner');
    await h.createCourse(owner, { title: 'Logged course' });
    entry = await ActivityLog.findOne({ action: 'created' });
  });
  after(h.teardown);

  const attempts = {
    're-saving an existing entry': async () => {
      entry.action = 'updated';
      await entry.save();
    },
    updateOne: () => ActivityLog.updateOne({ _id: entry._id }, { action: 'updated' }),
    updateMany: () => ActivityLog.updateMany({}, { action: 'updated' }),
    findOneAndUpdate: () => ActivityLog.findOneAndUpdate({ _id: entry._id }, { action: 'updated' }),
    replaceOne: () => ActivityLog.replaceOne({ _id: entry._id }, { action: 'updated' }),
    deleteOne: () => ActivityLog.deleteOne({ _id: entry._id }),
    deleteMany: () => ActivityLog.deleteMany({}),
    findOneAndDelete: () => ActivityLog.findOneAndDelete({ _id: entry._id }),
    'document deleteOne': async () => (await ActivityLog.findById(entry._id)).deleteOne(),
    bulkWrite: () => ActivityLog.bulkWrite([{ deleteOne: { filter: { _id: entry._id } } }]),
  };

  for (const [name, attempt] of Object.entries(attempts)) {
    it(`rejects ${name}`, async () => {
      await assert.rejects(attempt, /append-only/);
    });
  }

  it('still has every entry, unchanged', async () => {
    const stored = await ActivityLog.findById(entry._id).lean();
    assert.equal(stored.action, 'created');
    assert.ok((await ActivityLog.countDocuments()) >= 4); // created, 2 lessons added, published
  });
});
