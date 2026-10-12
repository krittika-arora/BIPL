const { body } = require('express-validator');

const enrolByEmailRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Enter the learner\'s email address.')
    .bail()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .toLowerCase(),
];

module.exports = { enrolByEmailRules };
