const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (env.mail.transport !== 'smtp') return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      // On port 587 the connection must be upgraded to TLS; never send credentials in clear text.
      requireTLS: !env.mail.secure && env.isProduction,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

// "CourseTrack <me@example.com>" → { name: 'CourseTrack', email: 'me@example.com' }
function parseAddress(value) {
  const match = String(value).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return { email: String(value).trim() };
  const name = match[1].replace(/^"|"$/g, '');
  return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
}

// Sends through Brevo's transactional email API over HTTPS (no SMTP port needed).
async function sendViaBrevo({ to, subject, text, html }) {
  const response = await fetch(env.mail.apiUrl, {
    method: 'POST',
    headers: {
      'api-key': env.mail.apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseAddress(env.mail.from),
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html || undefined,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Brevo API ${response.status}: ${detail.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }
}

// One line for the startup log, never including the password or API key.
function describeTransport() {
  if (env.mail.transport === 'brevo') {
    return `Mail: Brevo HTTPS API, from ${env.mail.from}`;
  }
  if (env.mail.transport !== 'smtp') {
    return 'Mail: no SMTP_HOST set, emails will be printed to this console';
  }
  const { host, port, secure, user, from } = env.mail;
  const login = user ? ` as ${user}` : '';
  return `Mail: SMTP ${host}:${port} (${secure ? 'TLS' : 'STARTTLS'})${login}, from ${from}`;
}

async function sendMail({ to, subject, text, html }) {
  if (env.mail.transport === 'brevo') {
    await sendViaBrevo({ to, subject, text, html });
    return { delivered: true };
  }
  const smtp = getTransporter();
  if (!smtp) {
    // Development only (env.js refuses to start in production without SMTP).
    console.log(
      [
        '',
        '----- email (not sent: no SMTP configured) -----',
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        text,
        '-------------------------------------------------',
        '',
      ].join('\n'),
    );
    return { delivered: false };
  }
  await smtp.sendMail({ from: env.mail.from, to, subject, text, html });
  return { delivered: true };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function sendSignupCode({ to, name, code, minutesValid }) {
  const text = [
    `Hi ${name},`,
    '',
    `Your CourseTrack verification code is: ${code}`,
    '',
    `It expires in ${minutesValid} minutes.`,
    'If you did not try to create an account, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; color: #212529">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your CourseTrack verification code is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0">${code}</p>
      <p>It expires in ${minutesValid} minutes.</p>
      <p style="color: #6c757d; font-size: 13px">
        If you did not try to create an account, you can ignore this email.
      </p>
    </div>`;

  return sendMail({ to, subject: 'Your CourseTrack verification code', text, html });
}

function sendPasswordResetCode({ to, name, code, minutesValid }) {
  const text = [
    `Hi ${name},`,
    '',
    `Your CourseTrack password reset code is: ${code}`,
    '',
    `It expires in ${minutesValid} minutes.`,
    'If you did not ask to reset your password, you can ignore this email.',
    'Your password has not been changed.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; color: #212529">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your CourseTrack password reset code is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0">${code}</p>
      <p>It expires in ${minutesValid} minutes.</p>
      <p style="color: #6c757d; font-size: 13px">
        If you did not ask to reset your password, you can ignore this email.
        Your password has not been changed.
      </p>
    </div>`;

  return sendMail({ to, subject: 'Reset your CourseTrack password', text, html });
}

async function verifyConnection() {
  const smtp = getTransporter();
  if (!smtp) return false;
  await smtp.verify();
  return true;
}

module.exports = {
  sendMail,
  sendSignupCode,
  sendPasswordResetCode,
  verifyConnection,
  describeTransport,
};
