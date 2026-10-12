const express = require('express');
const authController = require('../controllers/authController');
const passwordResetController = require('../controllers/passwordResetController');
const { requireAuth, guestOnly } = require('../middleware/auth');
const {
  registerRules,
  loginRules,
  verifyCodeRules,
  forgotPasswordRules,
  resetPasswordRules,
} = require('../validators/authValidators');

const router = express.Router();

router.get('/login', guestOnly, authController.showLogin);
router.post('/login', guestOnly, loginRules, authController.login);
router.get('/register', guestOnly, authController.showRegister);
router.post('/register', guestOnly, registerRules, authController.register);
router.get('/register/verify', guestOnly, authController.showVerify);
router.post('/register/verify', guestOnly, verifyCodeRules, authController.verify);
router.post('/register/resend', guestOnly, authController.resend);
router.post('/logout', requireAuth, authController.logout);

router.get('/forgot-password', guestOnly, passwordResetController.showForgot);
router.post(
  '/forgot-password',
  guestOnly,
  forgotPasswordRules,
  passwordResetController.requestCode,
);
router.get('/forgot-password/reset', guestOnly, passwordResetController.showReset);
router.post('/forgot-password/reset', guestOnly, resetPasswordRules, passwordResetController.reset);
router.post('/forgot-password/resend', guestOnly, passwordResetController.resend);

module.exports = router;
