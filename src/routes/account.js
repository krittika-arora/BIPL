const express = require('express');
const accountController = require('../controllers/accountController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { deleteAccountRules } = require('../validators/accountValidators');
const { ROLES } = require('../config/constants');

// Always the signed-in user's own account: no route here takes a user id.
const router = express.Router();

router.get('/', requireAuth, accountController.show);
router.post('/delete', requireRole(ROLES.LEARNER), deleteAccountRules, accountController.destroy);

module.exports = router;
