// Checks the SMTP settings in .env by connecting, logging in and sending one email.
// Usage: npm run mail:test -- you@example.com
const mailService = require('../src/services/mailService');

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: npm run mail:test -- you@example.com');
    process.exitCode = 1;
    return;
  }

  console.log(mailService.describeTransport());
  if (await mailService.verifyConnection()) {
    console.log('Connected and logged in to the SMTP server.');
  }

  const result = await mailService.sendMail({
    to,
    subject: 'CourseTrack test email',
    text: 'If you can read this, CourseTrack can send email with your SMTP settings.',
  });
  console.log(result.delivered ? `Sent to ${to}. Check the inbox (and spam folder).` : 'Printed above instead of sending.');
}

main().catch((err) => {
  console.error(`Sending failed: ${err.message}`);
  if (err.code === 'EAUTH') console.error('The server rejected the username or password (for Gmail, use an App Password).');
  if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNECTION') {
    console.error('Could not reach the server. Check SMTP_HOST, SMTP_PORT and SMTP_SECURE (465 = true, 587 = false).');
  }
  process.exitCode = 1;
});
