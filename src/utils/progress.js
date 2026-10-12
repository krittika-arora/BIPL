// Pure progress helpers shared by progressService and the views.

function idSet(ids) {
  return new Set(ids.map((id) => id.toString()));
}

// How many of the course's current lessons this enrolment has completed.
// Lessons removed after being completed no longer count.
function countCompleted(enrollment, lessonIds) {
  const done = idSet(enrollment.completedLessons || []);
  return lessonIds.filter((id) => done.has(id.toString())).length;
}

function allLessonsCompleted(enrollment, lessonIds) {
  return lessonIds.length > 0 && countCompleted(enrollment, lessonIds) === lessonIds.length;
}

// A completed course stays at 100% even if a lesson is added later; see docs/decisions.md.
function progressPercent(enrollment, lessonIds) {
  if (enrollment.status === 'completed') return 100;
  if (!lessonIds.length) return 0;
  return Math.round((countCompleted(enrollment, lessonIds) / lessonIds.length) * 100);
}

function isLessonCompleted(enrollment, lessonId) {
  return Boolean(enrollment) && idSet(enrollment.completedLessons || []).has(lessonId.toString());
}

module.exports = { countCompleted, allLessonsCompleted, progressPercent, isLessonCompleted };
