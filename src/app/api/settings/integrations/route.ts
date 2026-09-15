import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";
import { createIntegration } from "@/lib/integrations";

// GET /api/settings/integrations
// List all integrations for the tenant
export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;
    const { payload, user } = auth;
    
    if (!user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 403 });
    }

    const integrations = await prisma.integration.findMany({
      where: {
        companyId: user.companyId,
      },
      select: {
        id: true,
        provider: true,
        type: true,
        externalId: true,
        displayName: true,
        status: true,
        connectionMeta: true,
        lastSyncAt: true,
        errorMessage: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // DO NOT select credentials to prevent leakage
      },
      orderBy: {
        createdAt: "desc",
      }
    });

    return NextResponse.json(integrations);
  } catch (error: any) {
    console.error("GET /api/settings/integrations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

// POST /api/settings/integrations
// Create a new integration (mock/initiate flow)
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;
    const { payload, user } = auth;

    if (!user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 403 });
    }

    // Role check: Only ADMIN and SUPER_ADMIN
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const body = await request.json();
    const { provider, type, externalId, displayName, credentialsPayload, connectionMeta } = body;

    if (!provider || !type || !externalId || !displayName || !credentialsPayload) {
      return NextResponse.json(
        { error: "Missing required integration fields" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.integration.findFirst({
      where: {
        companyId: user.companyId,
        provider,
        type,
        externalId,
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Integration already exists" }, { status: 409 });
    }

    const newIntegration = await createIntegration({
      companyId: user.companyId,
      provider,
      type,
      externalId,
      displayName,
      credentialsPayload,
      connectionMeta
    });

    // Audit log
    await logAuditEvent({
      action: "INTEGRATION_CONNECTED",
      category: "Settings",
      severity: "SUCCESS",
      actorName: payload.name || payload.email,
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: displayName,
      summary: `Connected ${provider} integration (${type})`,
      ipAddress: getIpFromRequest(request),
    });

    // Remove credentials from response
    const { credentials, ...safeIntegration } = newIntegration;

    return NextResponse.json(safeIntegration, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/settings/integrations error:", error);
    
    await logAuditEvent({
      action: "INTEGRATION_FAILED",
      category: "Settings",
      severity: "DANGER",
      actorName: "System",
      actorEmail: "",
      actorRole: "SYSTEM",
      summary: `Failed to connect integration: ${error.message}`,
    });

    return NextResponse.json(
      { error: error?.message || "Failed to create integration" },
      { status: 500 }
    );
  }
}
