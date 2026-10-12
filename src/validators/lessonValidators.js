const { body } = require('express-validator');

const lessonRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required.')
    .isLength({ max: 120 })
    .withMessage('Title must be 120 characters or fewer.'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Lesson content is required.')
    .isLength({ max: 10000 })
    .withMessage('Lesson content must be 10,000 characters or fewer.'),
];

module.exports = { lessonRules };
