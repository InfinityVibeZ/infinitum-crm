// scripts/inspect_mime_debug.js
// Temporary script to generate raw MIME of the password reset email using the same content as sendPasswordResetEmail.
// Does NOT send email, only prints the RFC822 message for inspection.

const nodemailer = require('nodemailer');

(async () => {
  // Values based on current configuration (as observed in previous send logs)
  const from = '"Infinity Vibez Team" <builtby.rajum@gmail.com>'; // matches envelope.from
  const to = 'mouli.ec109@gmail.com';
  const subject = 'Reset your Infinity Vibez password';
  const resetUrl = 'https://example.com/reset-password?token=PLACEHOLDER'; // placeholder token
  const textContent = `Hello Test User,

We received a request to reset your password.

Email: ${to}

Use the secure link below to create a new password:
${resetUrl}

This secure password reset link expires in 30 minutes and can only be used once.

If you didn't request this password reset, you can safely ignore this email.

Regards,
Infinity Vibez Team`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #111827; color: #f3f4f6; border-radius: 12px; border: 1px solid #374151;">
      <h2 style="color: #f59e0b; font-size: 20px; font-weight: bold; margin-bottom: 16px;">Reset Password Request</h2>
      <p style="font-size: 14px; color: #e5e7eb; line-height: 1.6;">Hello <strong>Test User</strong>,</p>
      <p style="font-size: 14px; color: #d1d5db; line-height: 1.6;">We received a request to reset your password.</p>
      <div style="background-color: #1f2937; padding: 12px 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #4b5563;">
        <p style="margin: 0; font-size: 13px; color: #9ca3af;">Email: <strong style='color: #ffffff;'>${to}</strong></p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #f59e0b; color: #000000; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">Reset Password</a>
      </div>
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-top: 24px;">This secure password reset link expires in <strong>30 minutes</strong> and can only be used once.</p>
      <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">If you didn't request this password reset, you can safely ignore this email.</p>
      <p style="font-size: 12px; color: #6b7280;">Regards,<br /><strong>Infinity Vibez Team</strong></p>
    </div>`;

  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });

  const info = await transporter.sendMail({ from, to, subject, text: textContent, html: htmlContent });
  console.log('--- RAW MIME START ---');
  console.log(info.message.toString());
  console.log('--- RAW MIME END ---');
})();
