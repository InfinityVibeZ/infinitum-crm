import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";
import { getProvider } from "@/lib/integrations/provider-registry";
import { getIntegrationCredentials } from "@/lib/integrations";

// GET /api/settings/integrations/[id]
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;
    const { payload, user } = auth;

    if (!user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 403 });
    }

    const integration = await prisma.integration.findFirst({
      where: {
        id: params.id,
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
      }
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    return NextResponse.json(integration);
  } catch (error: any) {
    console.error("GET /api/settings/integrations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch integration" },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/integrations/[id]
// DELETE /api/settings/integrations/[id]
// Disconnect integration without deleting historical data.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) return auth;

    const { payload, user } = auth;

    if (!user.companyId) {
      return NextResponse.json(
        { error: "No company associated with user" },
        { status: 403 }
      );
    }

    if (
      payload.role !== "ADMIN" &&
      payload.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Admins only" },
        { status: 403 }
      );
    }

    const integration = await prisma.integration.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    /*
     * Attempt provider-level disconnect.
     *
     * Failure here should NOT prevent the local integration
     * from being marked disconnected. This is important because
     * the provider may already be disconnected/revoked.
     */
    try {
      const provider = getProvider(integration.provider);

      const credentials =
        await getIntegrationCredentials(
          integration.id,
          user.companyId
        );

      await provider.disconnect(credentials);
    } catch (error: unknown) {
      console.warn(
        `Could not disconnect ${integration.provider} at provider level:`,
        error instanceof Error
          ? error.message
          : String(error)
      );
    }

    /*
     * IMPORTANT:
     *
     * Do NOT delete the Integration record.
     *
     * Historical conversations/messages must remain intact.
     *
     * Instead mark the integration as disconnected/inactive.
     */
    const disconnectedIntegration =
      await prisma.integration.update({
        where: {
          id: integration.id,
        },
        data: {
          status: "DISCONNECTED",
          isActive: false,
          errorMessage: null,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          provider: true,
          type: true,
          externalId: true,
          displayName: true,
          status: true,
          isActive: true,
          updatedAt: true,
        },
      });

    // Audit log
    await logAuditEvent({
      action: "INTEGRATION_DISCONNECTED",
      category: "Settings",
      severity: "WARNING",
      actorName: payload.name || payload.email,
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: integration.displayName,
      summary: `Disconnected ${integration.provider} integration (${integration.type})`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json(
      {
        success: true,
        integration: disconnectedIntegration,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error(
      "DELETE /api/settings/integrations/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect integration",
      },
      { status: 500 }
    );
  }
}
