const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, guestOnly } = require('../middleware/auth');
const { registerRules, loginRules, verifyCodeRules } = require('../validators/authValidators');

const router = express.Router();

router.get('/login', guestOnly, authController.showLogin);
router.post('/login', guestOnly, loginRules, authController.login);
router.get('/register', guestOnly, authController.showRegister);
router.post('/register', guestOnly, registerRules, authController.register);
router.get('/register/verify', guestOnly, authController.showVerify);
router.post('/register/verify', guestOnly, verifyCodeRules, authController.verify);
router.post('/register/resend', guestOnly, authController.resend);
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
