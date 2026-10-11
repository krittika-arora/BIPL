const ActivityLog = require('../models/ActivityLog');

function record({ course, actor, action, changes = [] }) {
  return ActivityLog.create({ course, actor, action, changes });
}

// Oldest first, so the log reads as a timeline.
function listForCourse(courseId) {
  return ActivityLog.find({ course: courseId })
    .populate('actor', 'name role')
    .sort({ createdAt: 1, _id: 1 })
    .lean();
}

module.exports = { record, listForCourse };
