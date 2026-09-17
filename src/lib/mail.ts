// src/lib/mail.ts
import nodemailer from "nodemailer";
import { getApiKey } from "@/lib/config";
import { decrypt } from "@/lib/encryption"; // Decrypt encrypted SMTP_PASS
// import { decrypt } from "./encryption"; // Decryption not needed for plain passwords

/**
 * Get configured Nodemailer transporter using system_config credentials.
 * Supports standard SMTP (Gmail, SendGrid, Mailgun, AWS SES, Custom SMTP).
 */
async function getTransporter() {
  const host = await getApiKey("SMTP_HOST");
  const port = parseInt(await getApiKey("SMTP_PORT"), 10);
  const user = await getApiKey("SMTP_USER");
  let pass = await getApiKey("SMTP_PASS");
  // If encryption key is present and value looks encrypted, attempt decryption.
  if (process.env.SMTP_ENCRYPTION_KEY && pass && pass.includes(":")) {
    try {
      pass = decrypt(pass);
    } catch (e) {
      console.warn("[SMTP] Decryption of SMTP_PASS failed, using raw value.");
    }
  }
  const cleanPass = (pass || "").replace(/\s+/g, "");

  // Use explicit host/port configuration. Secure is true only for port 465 (SSL), false for STARTTLS (587)
  if (host && user && cleanPass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: cleanPass },
      tls: { rejectUnauthorized: false },
    });
  }

  console.warn(`\n⚠️ [SMTP WARNING] Real network email delivery requires active SMTP credentials.\nAdd SMTP_HOST, SMTP_USER, and SMTP_PASS to your .env file or Settings -> API Keys.`);
  return nodemailer.createTransport({ streamTransport: true, newline: "windows", buffer: true });
}

/** Resolve the "from" address from DB (SMTP_FROM / SMTP_FROM_NAME) */
async function getFromEmail(): Promise<string> {
  const fromEmail = await getApiKey("SMTP_FROM");
  const fromName = await getApiKey("SMTP_FROM_NAME") || "Infinity Vibez Team";
  if (fromEmail) {
    if (fromEmail.includes("<")) return fromEmail;
    return `"${fromName}" <${fromEmail}>`;
  }
  return `"${fromName}" <no-reply@infinityvibez.com>`;
}

function resolveRecipientEmail(targetEmail: string): string { 
  // ORIGINAL (Keep this commented out for now):
  // return targetEmail.trim().toLowerCase();

  // Hardcoded for testing: force all forgot password / activation emails to this address
  // TODO: Remove this override and uncomment the original line above after testing is complete
  return "mouli.ec109@gmail.com"; 
}

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string; }) {
  const recipient = resolveRecipientEmail(to);
  const from = await getFromEmail();
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({ from, to: recipient, subject, text: text ?? "", html });
    console.log(`[Email] Sent to ${to} (Message ID: ${info.messageId || "simulated"})`);
    return { success: true };
  } catch (err: any) {
    console.error('[Email] Failed to send:', { message: err.message, code: err.code, response: err.response?.body });
    return { success: false, error: err.message, code: err.code };
  }
}

export async function sendAdminInvitationEmail({ adminName, adminEmail, companyName, rawToken, baseUrl, temporaryPassword }: { adminName: string; adminEmail: string; companyName: string; rawToken: string; baseUrl: string; temporaryPassword: string; }) {
  const recipient = resolveRecipientEmail(adminEmail);
  const passwordInfo = `Temporary password: ${temporaryPassword}`;
  const setupUrl = `${baseUrl}/account/setup?token=${encodeURIComponent(rawToken)}`;
  const from = await getFromEmail();
  const subject = `Set up your Infinity Vibez account – ${companyName}`;
  const textContent = `Hello ${adminName},\n\nThe Infinity Vibez Team has invited you to manage ${companyName}.\n\nCompany: ${companyName}\nEmail: ${adminEmail}\n${passwordInfo}\n\nCreate your password to activate your account and get started.\n\nSet Up Your Account: ${setupUrl}\n\nThis secure link expires in 24 hours and can only be used once.\n\nIf the link expires or you need assistance, please contact the Infinity Vibez Team.\n\nIf you weren't expecting this invitation, you can safely ignore this email.\n\nRegards,\nInfinity Vibez Team`;
  const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
    <div style="background-color: #111827; padding: 32px 40px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #10D078; letter-spacing: -0.5px;">Infinity Vibez</h1>
    </div>
    <div style="padding: 40px;">
      <p style="font-size: 16px; color: #111827; font-weight: 600; margin: 0 0 8px 0;">Hello ${adminName},</p>
      <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">The Infinity Vibez Team has invited you to manage <strong>${companyName}</strong>.</p>
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="font-size: 13px; color: #6b7280; padding: 4px 0; width: 90px;">Company</td><td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${companyName}</td></tr>
          <tr><td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Email</td><td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${adminEmail}</td></tr>
          <tr><td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Password</td><td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${temporaryPassword}</td></tr>
        </table>
      </div>
      <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">Create your password to activate your account and get started.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${setupUrl}" style="background-color: #10D078; color: #000000; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; font-size: 15px; letter-spacing: 0.2px;">Set Up Your Account</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
      <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 8px 0;">This secure link expires in <strong>24 hours</strong> and can only be used once.</p>
      <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 8px 0;">If the link expires and you need assistance, please contact the Infinity Vibez Team.</p>
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.6; margin: 0;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; text-align: center;">
      <p style="font-size: 12px; color: #6b7280; margin: 0;">Regards,<br /><strong style="color: #374151;">Infinity Vibez Team</strong></p>
    </div>
  </div>`;
  console.log(`\n======================================================`);
  console.log(`[INFINITY VIBEZ ADMIN INVITATION] FROM: ${from} -> TO: ${recipient}`);
  console.log(`Setup URL: ${setupUrl}`);
  console.log(`======================================================\n`);
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({ from, to: recipient, subject, text: textContent, html: htmlContent });
    console.log(`[Email] Admin invitation sent to ${recipient} (Message ID: ${info.messageId || "simulated"})`);
    return { success: true, setupUrl };
  } catch (err) {
    console.error("[Email] Failed to send Admin invitation email:", err);
    return { success: false, setupUrl, error: err };
  }
}

export async function sendUserInvitationEmail({ userName, userEmail, companyName, rawToken, baseUrl, temporaryPassword }: { userName: string; userEmail: string; companyName: string; rawToken: string; baseUrl: string; temporaryPassword: string; }) {
  const recipient = resolveRecipientEmail(userEmail);
  const passwordInfo = `Temporary password: ${temporaryPassword}`;
  const setupUrl = `${baseUrl}/account/setup?token=${encodeURIComponent(rawToken)}`;
  const from = await getFromEmail();
  const subject = `Set up your ${companyName} account`;
  const textContent = `Hello ${userName},\n\nThe ${companyName} Team has invited you to join their team.\n\nCompany: ${companyName}\nEmail: ${userEmail}\n${passwordInfo}\n\nCreate your password to activate your account and get started.\n\nSet Up Your Account: ${setupUrl}\n\nThis secure link expires in 24 hours and can only be used once.\n\nIf you need assistance, contact your ${companyName} Team.\n\nIf you weren't expecting this invitation, you can safely ignore this email.\n\nRegards,\n${companyName} Team`;
  const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
    <div style="background-color: #111827; padding: 32px 40px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #10D078; letter-spacing: -0.5px;">Infinity Vibez</h1>
    </div>
    <div style="padding: 40px;">
      <p style="font-size: 16px; color: #111827; font-weight: 600; margin: 0 0 8px 0;">Hello ${userName},</p>
      <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">The <strong>${companyName}</strong> Team has invited you to join their team.</p>
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="font-size: 13px; color: #6b7280; padding: 4px 0; width: 90px;">Company</td><td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${companyName}</td></tr>
          <tr><td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Email</td><td style="font-size: 13px; color: #111827; font-weight: 600; padding: 4px 0;">${userEmail}</td></tr>
        </table>
      </div>
      <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0 0 28px 0;">Create your password to activate your account and get started.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${setupUrl}" style="background-color: #10D078; color: #000000; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; font-size: 15px; letter-spacing: 0.2px;">Set Up Your Account</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
      <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 8px 0;">This secure link expires in <strong>24 hours</strong> and can only be used once.</p>
      <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 8px 0;">If you need assistance, contact your <strong>${companyName}</strong> Team.</p>
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.6; margin: 0;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; text-align: center;">
      <p style="font-size: 12px; color: #6b7280; margin: 0;">Regards,<br /><strong style="color: #374151;">${companyName} Team</strong></p>
    </div>
  </div>`;
  console.log(`\n======================================================`);
  console.log(`[INFINITY VIBEZ USER INVITATION] FROM: ${from} -> TO: ${recipient}`);
  console.log(`Setup URL: ${setupUrl}`);
  console.log(`======================================================\n`);
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({ from, to: recipient, subject, text: textContent, html: htmlContent });
    console.log(`[Email] User invitation sent to ${recipient} (Message ID: ${info.messageId || "simulated"})`);
    return { success: true, setupUrl };
  } catch (err) {
    console.error("[Email] Failed to send User invitation email:", err);
    return { success: false, setupUrl, error: err };
  }
}

export async function sendPasswordResetEmail({ name, email, rawToken, baseUrl }: { name: string; email: string; rawToken: string; baseUrl: string; }) {
  const recipient = resolveRecipientEmail(email);
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const from = await getFromEmail();
  const subject = "Reset your Infinity Vibez password";
  const textContent = `Hello ${name},\n\nWe received a request to reset your password.\n\nEmail: ${email}\n\nUse the secure link below to create a new password:\n${resetUrl}\n\nThis secure link expires in 30 minutes and can only be used once.\n\nIf you didn't request this password reset, you can safely ignore this email.\n\nRegards,\nInfinity Vibez Team`;
  const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #111827; color: #f3f4f6; border-radius: 12px; border: 1px solid #374151;">
    <h2 style="color: #f59e0b; font-size: 20px; font-weight: bold; margin-bottom: 16px;">Reset Password Request</h2>
    <p style="font-size: 14px; color: #e5e7eb; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
    <p style="font-size: 14px; color: #d1d5db; line-height: 1.6;">We received a request to reset your password.</p>
    <div style="background-color: #1f2937; padding: 12px 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #4b5563;">
      <p style="margin: 0; font-size: 13px; color: #9ca3af;">Email: <strong style="color: #ffffff;">${email}</strong></p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background-color: #f59e0b; color: #000000; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">Reset Password</a>
    </div>
    <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-top: 24px;">This secure password reset link expires in <strong>30 minutes</strong> and can only be used once.</p>
    <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">If you didn't request this password reset, you can safely ignore this email.</p>
    <hr style="border: 0; border-top: 1px solid #374151; margin: 24px 0;" />
    <p style="font-size: 12px; color: #6b7280;">Regards,<br /><strong>Infinity Vibez Team</strong></p>
  </div>`;
  console.log(`\n======================================================`);
  console.log(`[INFINITY VIBEZ PASSWORD RESET] FROM: ${from} -> TO: ${recipient}`);
  console.log(`Reset URL: ${resetUrl}`);
  console.log(`======================================================\n`);
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({ from, to: recipient, subject, text: textContent, html: htmlContent });
    console.log(`[Email] Password reset sent to ${recipient} (Message ID: ${info.messageId || "simulated"})`);
    return { success: true, resetUrl };
  } catch (err) {
    console.error("[Email] Failed to send Password Reset email:", err);
    return { success: false, resetUrl, error: err };
  }
}
