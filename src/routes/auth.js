const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, guestOnly } = require('../middleware/auth');
const { registerRules, loginRules } = require('../validators/authValidators');

const router = express.Router();

router.get('/login', guestOnly, authController.showLogin);
router.post('/login', guestOnly, loginRules, authController.login);
router.get('/register', guestOnly, authController.showRegister);
router.post('/register', guestOnly, registerRules, authController.register);
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
