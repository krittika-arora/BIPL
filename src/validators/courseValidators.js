const { body } = require('express-validator');
const { COURSE_CATEGORIES } = require('../config/constants');

const courseRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required.')
    .isLength({ max: 120 })
    .withMessage('Title must be 120 characters or fewer.'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required.')
    .isLength({ max: 2000 })
    .withMessage('Description must be 2000 characters or fewer.'),
  body('category').isIn(COURSE_CATEGORIES).withMessage('Choose a category from the list.'),
];

module.exports = { courseRules };
