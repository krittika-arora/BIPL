const { body } = require('express-validator');
const { COMMENT_MAX_LENGTH } = require('../config/constants');

const commentRules = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Write a comment before posting.')
    .isLength({ max: COMMENT_MAX_LENGTH })
    .withMessage(`Comments must be ${COMMENT_MAX_LENGTH} characters or fewer.`),
];

module.exports = { commentRules };
