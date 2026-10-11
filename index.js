const env = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const createApp = require('./src/app');

async function start() {
  await connectDB(env.mongoUri);

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`CourseTrack running on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
