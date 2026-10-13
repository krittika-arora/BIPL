const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const AlertDismissal = require('../models/AlertDismissal');
const activityService = require('./activityService');
const HttpError = require('../utils/httpError');
const { assertCourseOwner } = require('../utils/ownership');
const { PAGE_SIZE, SORT_FIELDS, buildCatalogueFilter } = require('../utils/catalogueQuery');
const {
  ROLES,
  COURSE_STATUS,
  COURSE_TRANSITIONS,
  ACTIVITY_ACTIONS,
} = require('../config/constants');

const EDITABLE_FIELDS = ['title', 'description', 'category'];

// How each legal transition is named in the activity log.
const TRANSITION_ACTIONS = {
  draft: { published: ACTIVITY_ACTIONS.PUBLISHED },
  published: { archived: ACTIVITY_ACTIONS.ARCHIVED },
  archived: { published: ACTIVITY_ACTIONS.RESTORED },
};

// Visitors (no user) and learners only ever see published courses; instructors see everything.
function visibilityFilter(user) {
  return user && user.role === ROLES.INSTRUCTOR ? {} : { status: COURSE_STATUS.PUBLISHED };
}

const enrollmentCountStages = [
  {
    $lookup: {
      from: Enrollment.collection.name,
      localField: '_id',
      foreignField: 'course',
      pipeline: [{ $count: 'n' }],
      as: 'enrollmentStats',
    },
  },
  { $set: { enrollmentCount: { $ifNull: [{ $first: '$enrollmentStats.n' }, 0] } } },
  { $unset: 'enrollmentStats' },
];

const instructorNameStages = [
  {
    $lookup: {
      from: User.collection.name,
      localField: 'instructor',
      foreignField: '_id',
      pipeline: [{ $project: { name: 1 } }],
      as: 'instructor',
    },
  },
  { $set: { instructor: { $first: '$instructor' } } },
];

// Search, filtering, sorting and pagination all run in one aggregation in the database.
// $facet returns the requested page and the total match count from the same query.
async function listCourses(user, params) {
  const direction = params.dir === 'asc' ? 1 : -1;
  const sortByEnrollments = params.sort === 'enrollments';
  const skip = (params.page - 1) * PAGE_SIZE;

  const pageStages = [
    // _id breaks ties so pages never overlap or skip a course.
    { $sort: { [SORT_FIELDS[params.sort]]: direction, _id: direction } },
    { $skip: skip },
    { $limit: PAGE_SIZE },
    // When not sorting by it, count enrolments only for the 10 courses on this page.
    ...(sortByEnrollments ? [] : enrollmentCountStages),
    ...instructorNameStages,
  ];

  const [result] = await Course.aggregate([
    { $match: buildCatalogueFilter(params, user) },
    ...(sortByEnrollments ? enrollmentCountStages : []),
    { $facet: { courses: pageStages, total: [{ $count: 'n' }] } },
  ]).collation({ locale: 'en', strength: 2 }); // case-insensitive title order

  const total = result.total.length ? result.total[0].n : 0;
  return {
    courses: result.courses,
    total,
    page: params.page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

async function countPublishedCategories() {
  const categories = await Course.distinct('category', { status: COURSE_STATUS.PUBLISHED });
  return categories.length;
}

function listInstructors() {
  return User.find({ role: ROLES.INSTRUCTOR }).select('name').sort({ name: 1 }).lean();
}

async function getVisibleCourse(user, courseId) {
  const course = await Course.findOne({ _id: courseId, ...visibilityFilter(user) })
    .populate('instructor', 'name')
    .lean();
  if (!course) throw new HttpError(404, 'Course not found.');
  return course;
}

// The course as a document the actor may change. Only its owner gets past this.
async function getCourseForEdit(courseId, actor) {
  const course = await Course.findById(courseId);
  if (!course) throw new HttpError(404, 'Course not found.');
  assertCourseOwner(actor, course);
  return course;
}

// All course writes go through this service so every change lands in the activity log.
async function createCourse(actor, data) {
  const course = await Course.create({
    title: data.title,
    description: data.description,
    category: data.category,
    instructor: actor._id,
  });
  await activityService.record({
    course: course._id,
    actor: actor._id,
    action: ACTIVITY_ACTIONS.CREATED,
  });
  return course;
}

// Applies only the fields that actually changed and logs them as { field, from, to }.
async function updateCourse(actor, courseId, data) {
  const course = await getCourseForEdit(courseId, actor);

  const changes = [];
  for (const field of EDITABLE_FIELDS) {
    if (data[field] !== undefined && data[field] !== course[field]) {
      changes.push({ field, from: course[field], to: data[field] });
      course[field] = data[field];
    }
  }

  if (changes.length) {
    await course.save();
    await activityService.record({
      course: course._id,
      actor: actor._id,
      action: ACTIVITY_ACTIONS.UPDATED,
      changes,
    });
  }
  return { course, changes };
}

// The single entry point for course status changes: draft -> published -> archived, and restore.
async function transitionCourse(actor, courseId, toStatus) {
  const course = await getCourseForEdit(courseId, actor);
  const from = course.status;

  if (!Object.values(COURSE_STATUS).includes(toStatus)) {
    throw HttpError.ruleViolation(`"${toStatus}" is not a course status.`);
  }
  if (!COURSE_TRANSITIONS[from].includes(toStatus)) {
    const allowed = COURSE_TRANSITIONS[from].join(' or ');
    throw HttpError.ruleViolation(
      `This ${from} course cannot be moved to ${toStatus}. It can only be moved to ${allowed}.`,
    );
  }
  if (toStatus === COURSE_STATUS.PUBLISHED) {
    const lessonCount = await Lesson.countDocuments({ course: course._id });
    if (lessonCount === 0) {
      throw HttpError.ruleViolation('A course needs at least one lesson before it can be published.');
    }
  }

  // Conditional on the status we checked, so two simultaneous requests cannot both apply.
  const result = await Course.updateOne({ _id: course._id, status: from }, { $set: { status: toStatus } });
  if (result.modifiedCount === 0) {
    throw HttpError.ruleViolation('This course was changed by someone else. Reload and try again.');
  }

  course.status = toStatus;
  await activityService.record({
    course: course._id,
    actor: actor._id,
    action: TRANSITION_ACTIONS[from][toStatus],
    changes: [{ field: 'status', from, to: toStatus }],
  });
  return { course, from, to: toStatus };
}

// Permanently deletes a course and its lessons. Only its owner can, and only while nobody has
// ever enrolled: deleting a course people have taken would erase their progress and completion
// records, which archiving exists to preserve. The deletion itself stays in the activity log.
async function deleteCourse(actor, courseId) {
  const course = await getCourseForEdit(courseId, actor);

  const enrolled = await Enrollment.countDocuments({ course: course._id });
  if (enrolled > 0) {
    const who = enrolled === 1 ? '1 learner has' : `${enrolled} learners have`;
    throw HttpError.ruleViolation(
      `${who} enrolled in this course, so deleting it would erase their progress records. ` +
        'Archive it instead: it leaves the catalogue and everyone\'s history is kept.',
    );
  }

  await activityService.record({
    course: course._id,
    actor: actor._id,
    action: ACTIVITY_ACTIONS.DELETED,
    subject: course.title,
  });
  // The course first, so no new enrolment can start while its lessons are being removed.
  await Course.deleteOne({ _id: course._id });
  const { deletedCount: lessonsDeleted } = await Lesson.deleteMany({ course: course._id });
  await AlertDismissal.deleteMany({ course: course._id });
  return { title: course.title, lessonsDeleted };
}

module.exports = {
  listCourses,
  countPublishedCategories,
  listInstructors,
  getVisibleCourse,
  getCourseForEdit,
  createCourse,
  updateCourse,
  transitionCourse,
  deleteCourse,
};
