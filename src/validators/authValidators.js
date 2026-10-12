const { body } = require('express-validator');

const emailRule = body('email')
  .trim()
  .notEmpty()
  .withMessage('Email is required.')
  .bail()
  .isEmail()
  .withMessage('Enter a valid email address.')
  .toLowerCase();

// New password and its confirmation: the same rules at sign-up and when resetting.
const newPasswordRules = [
  body('password')
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be between 8 and 72 characters.')
    .bail()
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter.')
    .bail()
    .matches(/\d/)
    .withMessage('Password must contain at least one number.'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

const codeRule = body('code')
  .customSanitizer((value) => String(value || '').replace(/\s+/g, ''))
  .matches(/^\d{6}$/)
  .withMessage('Enter the 6-digit code from the email.');

const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 80 })
    .withMessage('Name must be 80 characters or fewer.'),
  emailRule,
  ...newPasswordRules,
];

const loginRules = [
  emailRule,
  body('password').notEmpty().withMessage('Password is required.'),
];

const verifyCodeRules = [codeRule];
const forgotPasswordRules = [emailRule];
const resetPasswordRules = [codeRule, ...newPasswordRules];

module.exports = {
  registerRules,
  loginRules,
  verifyCodeRules,
  forgotPasswordRules,
  resetPasswordRules,
};
