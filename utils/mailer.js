const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: '127.0.0.1',
  port: 1025,
  secure: false,
  tls: { rejectUnauthorized: false },
});

exports.sendVerificationEmail = async (to, token) => {
  const url = `http://62.72.3.138/verify-email/${token}`; // Update to match Flutter URL later
  await transporter.sendMail({
    from: 'talktime@example.org',
    to,
    subject: 'Verify your TalkTime account',
    html: `<p>Welcome to TalkTime! Click to verify your email:</p><p><a href="${url}">${url}</a></p>`
  });
};
