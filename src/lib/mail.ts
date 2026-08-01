import nodemailer from "nodemailer";
import { getApiKey } from "./config";

/**
 * Get configured Nodemailer transporter using server-side environment / SystemConfig credentials.
 * Supports standard SMTP (Gmail, SendGrid, Mailgun, AWS SES, Custom SMTP).
 * Falls back to simulated stream log if SMTP credentials are missing.
 */
async function getTransporter() {
  const host = await getApiKey("SMTP_HOST", process.env.SMTP_HOST || "");
  const port = parseInt(await getApiKey("SMTP_PORT", process.env.SMTP_PORT || "587"), 10);
  const user = await getApiKey("SMTP_USER", process.env.SMTP_USER || "");
  const pass = await getApiKey("SMTP_PASS", process.env.SMTP_PASS || "");
  const cleanPass = pass.replace(/\s+/g, "");
  const service = process.env.SMTP_SERVICE || (host.includes("gmail") || user.endsWith("@gmail.com") ? "gmail" : "");

  if (service === "gmail" && user && cleanPass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass: cleanPass },
    });
  }

  if (host && user && cleanPass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: cleanPass },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // Warning when live SMTP credentials are missing
  console.warn(
    "\n⚠️ [SMTP WARNING] Real network email delivery requires active SMTP credentials.\n" +
    "Add SMTP_HOST, SMTP_USER, and SMTP_PASS to your .env file or Settings -> API Keys.\n"
  );

  // Fallback stream transport for local debugging
  return nodemailer.createTransport({
    streamTransport: true,
    newline: "windows",
    buffer: true,
  });
}

/**
 * Utility: Resolve target email recipient.
 * Always dynamically returns the registered account email entered during creation/reset.
 */
function resolveRecipientEmail(targetEmail: string): string {
  return targetEmail.trim().toLowerCase();
}

/**
 * Send Admin Account Setup Invitation Email
 */
export async function sendAdminInvitationEmail({
  adminName,
  adminEmail,
  companyName,
  rawToken,
  baseUrl,
}: {
  adminName: string;
  adminEmail: string;
  companyName: string;
  rawToken: string;
  baseUrl: string;
}) {
  const recipient = resolveRecipientEmail(adminEmail);
  const setupUrl = `${baseUrl}/account/setup?token=${encodeURIComponent(rawToken)}`;
  const fromEmail = process.env.SMTP_FROM || '"Infinitum Team" <builtby.rajum@gmail.com>';

  const subject = `Set up your Infinitum account – ${companyName}`;
  const textContent = `Hello ${adminName},

The Infinitum Team has invited you to manage ${companyName}.

Company: ${companyName}
Email: ${adminEmail}

Create your password to activate your account and get started.

Set Up Your Account: ${setupUrl}

This secure link expires in 24 hours and can only be used once.

If the link expires or you need assistance, please contact the Infinitum Team.

If you weren't expecting this invitation, you can safely ignore this email.

Regards,
Infinitum Team`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background-color: #111827; padding: 32px 40px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #10D078; letter-spacing: -0.5px;">Infinitum</h1>
      </div>
      <div style="padding: 40px;">
        <p style="font-size: 16px; color: #111827; font-weight: 600; margin: 0 0 8px 0;">Hello ${adminName},</p>
        <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">The Infinitum Team has invited you to manage <strong>${companyName}</strong>.</p>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="font-size: 13px; color: #6b7280; padding: 4px 0; width: 90px;">Company</td>
              <td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${companyName}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Email</td>
              <td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${adminEmail}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">Create your password to activate your account and get started.</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${setupUrl}" style="background-color: #10D078; color: #000000; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; font-size: 15px; letter-spacing: 0.2px;">
            Set Up Your Account
          </a>
        </div>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

        <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 8px 0;">This secure link expires in <strong>24 hours</strong> and can only be used once.</p>
        <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 8px 0;">If the link expires or you need assistance, please contact the Infinitum Team.</p>
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.6; margin: 0;">If you weren't expecting this invitation, you can safely ignore this email.</p>
      </div>
      <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; text-align: center;">
        <p style="font-size: 12px; color: #6b7280; margin: 0;">Regards,<br /><strong style="color: #374151;">Infinitum Team</strong></p>
      </div>
    </div>
  `;

  console.log(`\n======================================================`);
  console.log(`[INFINITUM ADMIN INVITATION] FROM: ${fromEmail} -> TO: ${recipient}`);
  console.log(`Setup URL: ${setupUrl}`);
  console.log(`======================================================\n`);

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: fromEmail,
      replyTo: "builtby.rajum@gmail.com",
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Admin invitation sent to ${recipient} (Message ID: ${info.messageId || "simulated"})`);
    return { success: true, setupUrl };
  } catch (err) {
    console.error("[Email] Failed to send Admin invitation email:", err);
    return { success: false, setupUrl, error: err };
  }
}

/**
 * Send User Account Setup Invitation Email
 */
export async function sendUserInvitationEmail({
  userName,
  userEmail,
  companyName,
  rawToken,
  baseUrl,
}: {
  userName: string;
  userEmail: string;
  companyName: string;
  rawToken: string;
  baseUrl: string;
}) {
  const recipient = resolveRecipientEmail(userEmail);
  const setupUrl = `${baseUrl}/account/setup?token=${encodeURIComponent(rawToken)}`;
  const fromEmail = process.env.SMTP_FROM || '"Infinitum Team" <builtby.rajum@gmail.com>';

  const subject = `Set up your ${companyName} account`;
  const textContent = `Hello ${userName},

The ${companyName} Team has invited you to join their team.

Company: ${companyName}
Email: ${userEmail}

Create your password to activate your account and get started.

Set Up Your Account: ${setupUrl}

This secure link expires in 24 hours and can only be used once.

If the link expires or you need assistance, please contact your ${companyName} Team.

If you weren't expecting this invitation, you can safely ignore this email.

Regards,
${companyName} Team`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background-color: #111827; padding: 32px 40px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #10D078; letter-spacing: -0.5px;">Infinitum</h1>
      </div>
      <div style="padding: 40px;">
        <p style="font-size: 16px; color: #111827; font-weight: 600; margin: 0 0 8px 0;">Hello ${userName},</p>
        <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">The <strong>${companyName}</strong> Team has invited you to join their team.</p>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="font-size: 13px; color: #6b7280; padding: 4px 0; width: 90px;">Company</td>
              <td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${companyName}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Email</td>
              <td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${userEmail}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">Create your password to activate your account and get started.</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${setupUrl}" style="background-color: #10D078; color: #000000; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; font-size: 15px; letter-spacing: 0.2px;">
            Set Up Your Account
          </a>
        </div>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

        <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 8px 0;">This secure link expires in <strong>24 hours</strong> and can only be used once.</p>
        <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 8px 0;">If the link expires or you need assistance, please contact your <strong>${companyName}</strong> Team.</p>
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.6; margin: 0;">If you weren't expecting this invitation, you can safely ignore this email.</p>
      </div>
      <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; text-align: center;">
        <p style="font-size: 12px; color: #6b7280; margin: 0;">Regards,<br /><strong style="color: #374151;">${companyName} Team</strong></p>
      </div>
    </div>
  `;

  console.log(`\n======================================================`);
  console.log(`[INFINITUM USER INVITATION] FROM: ${fromEmail} -> TO: ${recipient}`);
  console.log(`Setup URL: ${setupUrl}`);
  console.log(`======================================================\n`);

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: fromEmail,
      replyTo: "builtby.rajum@gmail.com",
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] User invitation sent to ${recipient} (Message ID: ${info.messageId || "simulated"})`);
    return { success: true, setupUrl };
  } catch (err) {
    console.error("[Email] Failed to send User invitation email:", err);
    return { success: false, setupUrl, error: err };
  }
}

/**
 * Send Password Reset Email
 */
export async function sendPasswordResetEmail({
  name,
  email,
  rawToken,
  baseUrl,
}: {
  name: string;
  email: string;
  rawToken: string;
  baseUrl: string;
}) {
  const recipient = resolveRecipientEmail(email);
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const fromEmail = process.env.SMTP_FROM || '"Infinitum Team" <builtby.rajum@gmail.com>';

  const subject = "Reset your password";
  const textContent = `Hello ${name},

We received a request to reset your password.

Email: ${email}

Use the secure link below to create a new password:
${resetUrl}

This secure link expires in 24 hours and can only be used once.

If you didn't request this password reset, you can safely ignore this email.

Regards,
Infinitum Team`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #111827; color: #f3f4f6; border-radius: 12px; border: 1px solid #374151;">
      <h2 style="color: #f59e0b; font-size: 20px; font-weight: bold; margin-bottom: 16px;">Reset Password Request</h2>
      <p style="font-size: 14px; color: #e5e7eb; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #d1d5db; line-height: 1.6;">We received a request to reset your password.</p>

      <div style="background-color: #1f2937; padding: 12px 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #4b5563;">
        <p style="margin: 0; font-size: 13px; color: #9ca3af;">Email: <strong style="color: #ffffff;">${email}</strong></p>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #f59e0b; color: #000000; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px; shadow: 0 4px 12px rgba(245, 158, 11, 0.25);">
          Reset Password
        </a>
      </div>

      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-top: 24px;">This secure password reset link expires in <strong>24 hours</strong> and can only be used once.</p>
      <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">If you didn't request this password reset, you can safely ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #374151; margin: 24px 0;" />
      <p style="font-size: 12px; color: #6b7280;">Regards,<br /><strong>Infinitum Team</strong></p>
    </div>
  `;

  console.log(`\n======================================================`);
  console.log(`[INFINITUM PASSWORD RESET] FROM: ${fromEmail} -> TO: ${recipient}`);
  console.log(`Reset URL: ${resetUrl}`);
  console.log(`======================================================\n`);

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: fromEmail,
      replyTo: "builtby.rajum@gmail.com",
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] Password reset sent to ${recipient} (Message ID: ${info.messageId || "simulated"})`);
    return { success: true, resetUrl };
  } catch (err) {
    console.error("[Email] Failed to send Password Reset email:", err);
    return { success: false, resetUrl, error: err };
  }
}
