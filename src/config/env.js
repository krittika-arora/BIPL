// Loads configuration from environment variables. A local .env file is read
// when present; hosted environments inject the variables directly.
try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

// Fail fast instead of falling back to a hardcoded value.
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

// Outgoing email (sign-up verification codes). With no SMTP_HOST in development, emails are
// printed to the server console instead; production refuses to start without SMTP settings.
function mailConfig() {
  const host = process.env.SMTP_HOST || '';
  if (!host) {
    if (isProduction) throw new Error('Missing required environment variable: SMTP_HOST');
    return { transport: 'console', from: 'CourseTrack <no-reply@localhost>' };
  }

  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER || '';
  const from = process.env.MAIL_FROM || user;
  if (!from) {
    throw new Error('Set MAIL_FROM (or SMTP_USER) so emails have a sender address.');
  }
  return {
    transport: 'smtp',
    host,
    // 465 = TLS from the start (SMTP_SECURE=true); 587 = STARTTLS upgrade (SMTP_SECURE=false).
    port: Number(process.env.SMTP_PORT) || (secure ? 465 : 587),
    secure,
    user,
    pass: process.env.SMTP_PASS || '',
    from,
  };
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT) || 3000,
  mongoUri: required('MONGODB_URI'),
  sessionSecret: required('SESSION_SECRET'),
  mail: mailConfig(),
};
