import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";

/**
 * POST /api/admin/email-config/test
 * Super Admin only – Sends a test email using the current DB-stored SMTP configuration.
 * Never exposes SMTP credentials in the response.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;
    const { payload } = auth;

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const body = await request.json();
    const { to } = body;

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return NextResponse.json({ error: "A valid destination email address is required." }, { status: 400 });
    }

    const result = await sendEmail({
      to: to.trim().toLowerCase(),
      subject: "Infinity Vibez – SMTP Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111827; color: #f3f4f6; padding: 32px; border-radius: 12px; border: 1px solid #374151;">
          <h2 style="color: #10D078; font-size: 20px; margin-bottom: 16px;">✅ SMTP Test Successful</h2>
          <p style="font-size: 14px; color: #d1d5db; line-height: 1.6;">This is a test email from your <strong>Infinity Vibez</strong> platform.</p>
          <p style="font-size: 14px; color: #d1d5db; line-height: 1.6;">If you received this message, your SMTP email configuration is working correctly.</p>
          <hr style="border: 0; border-top: 1px solid #374151; margin: 24px 0;" />
          <p style="font-size: 12px; color: #6b7280;">Infinity Vibez Platform – Super Admin</p>
        </div>
      `,
      text: `SMTP Test Email - If you received this message, your SMTP configuration is working correctly.\n\nInfinity Vibez Platform – Super Admin`,
    });

    if (!result.success) {
      return NextResponse.json({ error: "Test email failed to send. Please check your SMTP configuration." }, { status: 500 });
    }

    return NextResponse.json({ message: `Test email successfully sent to ${to}.` });
  } catch (error) {
    console.error("POST /api/admin/email-config/test error:", error);
    return NextResponse.json({ error: "Internal server error. Check server logs for details." }, { status: 500 });
  }
}
