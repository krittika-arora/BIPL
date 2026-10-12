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

// One line for the startup log, never including the password.
function describeTransport() {
  if (env.mail.transport !== 'smtp') return 'Mail: no SMTP_HOST set, emails will be printed to this console';
  const { host, port, secure, user, from } = env.mail;
  return `Mail: SMTP ${host}:${port} (${secure ? 'TLS' : 'STARTTLS'})${user ? ` as ${user}` : ''}, from ${from}`;
}

async function sendMail({ to, subject, text, html }) {
  const smtp = getTransporter();
  if (!smtp) {
    // Development only (env.js refuses to start in production without SMTP).
    console.log(`\n----- email (not sent: no SMTP configured) -----\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-------------------------------------------------\n`);
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
    `It expires in ${minutesValid} minutes. If you did not try to create an account, you can ignore this email.`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; color: #212529">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your CourseTrack verification code is:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0">${code}</p>
      <p>It expires in ${minutesValid} minutes.</p>
      <p style="color: #6c757d; font-size: 13px">If you did not try to create an account, you can ignore this email.</p>
    </div>`;

  return sendMail({ to, subject: 'Your CourseTrack verification code', text, html });
}

async function verifyConnection() {
  const smtp = getTransporter();
  if (!smtp) return false;
  await smtp.verify();
  return true;
}

module.exports = { sendMail, sendSignupCode, verifyConnection, describeTransport };
