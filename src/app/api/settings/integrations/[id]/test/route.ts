import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getProvider } from "@/lib/integrations/provider-registry";
import { getIntegrationCredentials, updateIntegrationStatus } from "@/lib/integrations";

// POST /api/settings/integrations/[id]/test
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;
    const { payload, user } = auth;

    if (!user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 403 });
    }

    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const integration = await prisma.integration.findFirst({
      where: { id: params.id, companyId: user.companyId }
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    let isSuccess = false;
    let errorMessage = "Test failed";

    try {
      const provider = getProvider(integration.provider);
      const credentials = await getIntegrationCredentials(integration.id, user.companyId);
      
      isSuccess = await provider.testConnection(credentials);
      errorMessage = isSuccess ? "" : "Provider indicated connection failure";
    } catch (e: any) {
      console.warn(`Test connection failed for ${integration.provider}:`, e.message);
      errorMessage = e.message || "Unknown provider error";
      isSuccess = false;
    }

    const status = isSuccess ? "CONNECTED" : "ERROR";
    await updateIntegrationStatus(integration.id, user.companyId, status, isSuccess ? undefined : errorMessage, isSuccess);

    return NextResponse.json({
      success: isSuccess,
      status,
      errorMessage: isSuccess ? null : errorMessage
    }, { status: 200 });

  } catch (error: any) {
    console.error("POST /api/settings/integrations/[id]/test error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to test integration" },
      { status: 500 }
    );
  }
}
