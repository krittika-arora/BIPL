const path = require('path');
const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');
const env = require('./config/env');
const flash = require('./middleware/flash');
const { loadCurrentUser } = require('./middleware/auth');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');
const viewHelpers = require('./utils/viewHelpers');
const progressHelpers = require('./utils/progress');
const { isCourseOwner } = require('./utils/ownership');

const SESSION_TTL_SECONDS = 60 * 60 * 8;

// Expects mongoose to be connected already; the session store reuses its client.
function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.disable('x-powered-by');
  Object.assign(app.locals, viewHelpers, progressHelpers, { isCourseOwner });
  if (env.isProduction) app.set('trust proxy', 1);

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use(
    session({
      name: 'coursetrack.sid',
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        ttl: SESSION_TTL_SECONDS,
      }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.isProduction,
        maxAge: SESSION_TTL_SECONDS * 1000,
      },
    }),
  );
  app.use(flash);
  app.use(loadCurrentUser);
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  app.use(routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
