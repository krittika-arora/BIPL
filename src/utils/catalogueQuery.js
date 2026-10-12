const mongoose = require('mongoose');
const { ROLES, COURSE_STATUS, COURSE_CATEGORIES } = require('../config/constants');

const MAX_SEARCH_LENGTH = 100;
const PAGE_SIZE = 10;

// Allowed sort keys mapped to the field they sort on. Nothing else reaches $sort.
const SORT_FIELDS = Object.freeze({
  created: 'createdAt',
  title: 'title',
  enrollments: 'enrollmentCount',
});
const DEFAULT_SORT = { sort: 'created', dir: 'desc' };

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function single(value) {
  // ?q=a&q=b arrives as an array; only the first value is used.
  return typeof value === 'string' ? value : Array.isArray(value) ? single(value[0]) : '';
}

// Turns raw query-string values into a whitelisted set of filters. `user` is null for visitors.
// Anything unknown or malformed is dropped rather than passed to the database.
function parseCatalogueQuery(query, user) {
  const isInstructor = Boolean(user) && user.role === ROLES.INSTRUCTOR;

  const q = single(query.q).trim().slice(0, MAX_SEARCH_LENGTH);
  const category = COURSE_CATEGORIES.includes(single(query.category)) ? single(query.category) : '';
  const status =
    isInstructor && Object.values(COURSE_STATUS).includes(single(query.status)) ? single(query.status) : '';
  const instructor = mongoose.isValidObjectId(single(query.instructor)) ? single(query.instructor) : '';

  const sort = Object.hasOwn(SORT_FIELDS, single(query.sort)) ? single(query.sort) : DEFAULT_SORT.sort;
  const dir = ['asc', 'desc'].includes(single(query.dir)) ? single(query.dir) : DEFAULT_SORT.dir;
  const requestedPage = Number.parseInt(single(query.page), 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  return { q, category, status, instructor, sort, dir, page };
}

// Builds the MongoDB filter for the catalogue. Visitors and learners only ever get published courses.
function buildCatalogueFilter(params, user) {
  const filter = {};
  if (!user || user.role !== ROLES.INSTRUCTOR) filter.status = COURSE_STATUS.PUBLISHED;
  else if (params.status) filter.status = params.status;

  if (params.category) filter.category = params.category;
  if (params.instructor) filter.instructor = new mongoose.Types.ObjectId(params.instructor);
  if (params.q) {
    const pattern = new RegExp(escapeRegex(params.q), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }
  return filter;
}

module.exports = {
  PAGE_SIZE,
  SORT_FIELDS,
  DEFAULT_SORT,
  parseCatalogueQuery,
  buildCatalogueFilter,
  escapeRegex,
};
