const env = require('./src/config/env');
const createApp = require('./src/app');

const app = createApp();

app.listen(env.port, () => {
  console.log(`CourseTrack running on http://localhost:${env.port}`);
});
