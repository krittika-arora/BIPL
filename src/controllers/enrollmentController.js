const enrollmentService = require('../services/enrollmentService');
const HttpError = require('../utils/httpError');
const { collectErrors } = require('../utils/validation');
const { addressesFromText, addressesFromFile, normaliseAddresses } = require('../utils/emailList');
const { toCsv, slugify } = require('../utils/csv');

async function enrolSelf(req, res) {
  try {
    const { course } = await enrollmentService.enrolSelf(req.user, req.params.id);
    req.flash('success', `You are enrolled in "${course.title}".`);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('info', err.message);
  }
  res.redirect(`/courses/${req.params.id}`);
}

// The form lives on the course page, so problems are reported there as a flash message.
async function enrolByEmail(req, res) {
  const coursePath = `/courses/${req.params.id}`;
  const errors = collectErrors(req);
  if (errors) {
    req.flash('danger', errors.email);
    return res.redirect(coursePath);
  }

  try {
    const { learner } = await enrollmentService.enrolByEmail(req.user, req.params.id, req.body.email);
    req.flash('success', `${learner.name} has been enrolled.`);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    req.flash('danger', err.message);
  }
  res.redirect(coursePath);
}

async function bulkForm(req, res) {
  const course = await enrollmentService.getCourseForBulkForm(req.params.id, req.user);
  res.render('enrollments/bulk', { title: 'Bulk enrol', course, error: null, emails: '', report: null });
}

// Accepts pasted addresses, an uploaded .csv/.txt file, or both, and renders a per-address report.
async function bulkEnrol(req, res) {
  const course = await enrollmentService.getCourseForBulkForm(req.params.id, req.user);
  const emails = typeof req.body.emails === 'string' ? req.body.emails : '';
  const renderForm = (status, error, report = null) =>
    res.status(status).render('enrollments/bulk', { title: 'Bulk enrol', course, error, emails, report });

  if (req.uploadError) return renderForm(422, req.uploadError);

  const raw = [
    ...addressesFromText(emails),
    ...(req.file ? addressesFromFile(req.file.buffer.toString('utf8')) : []),
  ];

  try {
    const report = await enrollmentService.bulkEnrol(req.user, req.params.id, normaliseAddresses(raw));
    return renderForm(200, null, report);
  } catch (err) {
    if (!HttpError.isRuleViolation(err)) throw err;
    return renderForm(422, err.message);
  }
}

async function exportProgress(req, res) {
  const { course, headers, rows } = await enrollmentService.buildProgressReport(req.params.id);
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${slugify(course.title)}-progress-${date}.csv"`,
    'Cache-Control': 'no-store',
  });
  res.send(toCsv(headers, rows));
}

async function myLearning(req, res) {
  const rows = await enrollmentService.listLearnerEnrollments(req.user._id);
  const counts = { not_started: 0, in_progress: 0, completed: 0 };
  for (const { enrollment } of rows) counts[enrollment.status] += 1;
  res.render('enrollments/my-learning', { title: 'My learning', rows, counts });
}

module.exports = { enrolSelf, enrolByEmail, bulkForm, bulkEnrol, exportProgress, myLearning };
