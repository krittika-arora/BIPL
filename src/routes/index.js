const express = require('express');
const { requireAuth } = require('../middleware/auth');
const authRoutes = require('./auth');

const router = express.Router();

router.use(authRoutes);

router.get('/', requireAuth, (req, res) => {
  res.render('home', { title: 'Home' });
});

module.exports = router;
