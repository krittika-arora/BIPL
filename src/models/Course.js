const mongoose = require('mongoose');
const { COURSE_STATUS, COURSE_CATEGORIES } = require('../config/constants');

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, required: true, enum: COURSE_CATEGORIES },
    status: {
      type: String,
      enum: Object.values(COURSE_STATUS),
      default: COURSE_STATUS.DRAFT,
      index: true,
    },
    // The instructor who created and owns the course.
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Course', courseSchema);
