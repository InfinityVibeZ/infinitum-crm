import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/** GET /api/settings/api-keys — List all API keys (Super Admin only) */
export async function GET(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    // Fetch keys from database
    let configs = await prisma.systemConfig.findMany({
      where: { category: "API_KEY" },
      orderBy: { key: "asc" },
    });

    // If empty, seed default mock/empty keys for standard integrations
    if (configs.length === 0) {
      const defaults = [
        { key: "GEMINI_API_KEY", value: "nexus_gemini_sk_mock_key_value", label: "Google Gemini API Key", category: "API_KEY" },
        { key: "OPENAI_API_KEY", value: "nexus_openai_sk_mock_key_value", label: "OpenAI API Key", category: "API_KEY" },
        { key: "SENDGRID_API_KEY", value: "nexus_sendgrid_sk_mock_key_value", label: "SendGrid SMTP API Key", category: "API_KEY" },
        { key: "STRIPE_API_KEY", value: "nexus_stripe_sk_mock_key_value", label: "Stripe Payments API Key", category: "API_KEY" },
        { key: "SMTP_HOST", value: "smtp.gmail.com", label: "SMTP Mail Server Host", category: "API_KEY" },
        { key: "SMTP_PORT", value: "587", label: "SMTP Port (587 or 465)", category: "API_KEY" },
        { key: "SMTP_USER", value: "builtby.rajum@gmail.com", label: "SMTP Sender Username", category: "API_KEY" },
        { key: "SMTP_PASS", value: "", label: "SMTP App Password (Google 16-char code)", category: "API_KEY" },
      ];
      
      await prisma.systemConfig.createMany({ data: defaults });
      
      configs = await prisma.systemConfig.findMany({
        where: { category: "API_KEY" },
        orderBy: { key: "asc" },
      });
    }

    return NextResponse.json(configs);
  } catch (error) {
    console.error("GET /api/settings/api-keys error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

/** POST /api/settings/api-keys — Create or Update an API key (Super Admin only) */
export async function POST(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const body = await request.json();
    const { key, value, label } = body;

    if (!key || !value) {
      return NextResponse.json({ error: "Key identifier and value are required" }, { status: 400 });
    }

    const formattedKey = key.toUpperCase().replace(/\s+/g, "_");

    const updated = await prisma.systemConfig.upsert({
      where: { key: formattedKey },
      update: {
        value,
        ...(label && { label }),
      },
      create: {
        key: formattedKey,
        value,
        label: label || formattedKey,
        category: "API_KEY",
      },
    });

    await logAuditEvent({
      action: "API_KEY_UPDATED",
      category: "System",
      severity: "WARNING",
      actorName: payload.email.split("@")[0],
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: formattedKey,
      summary: `Updated API key: ${formattedKey}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/settings/api-keys error:", error);
    return NextResponse.json({ error: "Failed to save API key" }, { status: 500 });
  }
}

/** DELETE /api/settings/api-keys — Delete an API key (Super Admin only) */
export async function DELETE(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key parameter is required" }, { status: 400 });
    }

    await prisma.systemConfig.delete({
      where: { key },
    });

    await logAuditEvent({
      action: "API_KEY_DELETED",
      category: "System",
      severity: "DANGER",
      actorName: payload.email.split("@")[0],
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: key,
      summary: `Deleted API key: ${key}`,
    });

    return NextResponse.json({ message: "API key deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/settings/api-keys error:", error);
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
}
