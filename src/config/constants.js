const ROLES = Object.freeze({
  INSTRUCTOR: 'instructor',
  LEARNER: 'learner',
});

const COURSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

// The only legal course moves. Anything not listed here is rejected by courseService.
// archived -> published is "restore".
const COURSE_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['published']),
  published: Object.freeze(['archived']),
  archived: Object.freeze(['published']),
});

// A fixed list keeps filtering and reporting consistent; see docs/decisions.md.
const COURSE_CATEGORIES = Object.freeze([
  'Onboarding',
  'Compliance',
  'Technical Skills',
  'Leadership',
  'Communication',
]);

const ACTIVITY_ACTIONS = Object.freeze({
  CREATED: 'created',
  UPDATED: 'updated',
});

module.exports = {
  ROLES,
  COURSE_STATUS,
  COURSE_TRANSITIONS,
  COURSE_CATEGORIES,
  ACTIVITY_ACTIONS,
};
