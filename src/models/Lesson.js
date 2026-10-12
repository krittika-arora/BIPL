const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    // 1-based running order within the course. lessonService keeps it contiguous (1..n).
    position: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

// Not unique: swapping two positions would briefly collide. Contiguity is kept by the service.
lessonSchema.index({ course: 1, position: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);
