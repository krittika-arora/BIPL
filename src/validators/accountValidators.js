const { body } = require('express-validator');

const deleteAccountRules = [
  body('password').notEmpty().withMessage('Enter your password to confirm.'),
  body('confirm')
    .equals('yes')
    .withMessage('Tick the box to confirm you understand this cannot be undone.'),
];

module.exports = { deleteAccountRules };
