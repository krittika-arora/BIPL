const path = require('path');
const express = require('express');
const routes = require('./routes');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.disable('x-powered-by');

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use(routes);

  return app;
}

module.exports = createApp;
