const ROLES = Object.freeze({
  INSTRUCTOR: 'instructor',
  LEARNER: 'learner',
});

const COURSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

// A fixed list keeps filtering and reporting consistent; see docs/decisions.md.
const COURSE_CATEGORIES = Object.freeze([
  'Onboarding',
  'Compliance',
  'Technical Skills',
  'Leadership',
  'Communication',
]);

module.exports = { ROLES, COURSE_STATUS, COURSE_CATEGORIES };
