const express = require('express');
const { requireAuth } = require('../middleware/auth');
const authRoutes = require('./auth');
const courseRoutes = require('./courses');

const router = express.Router();

router.use(authRoutes);

router.get('/', requireAuth, (req, res) => {
  res.render('home', { title: 'Home' });
});

router.use('/courses', courseRoutes);

module.exports = router;
