import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIntegrationCredentials } from "@/lib/integrations";
import { discoverMetaAssets, saveMetaAssets } from "@/lib/integrations/meta-assets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuthenticatedUser(request, ["ADMIN", "SUPER_ADMIN"]);
  if (authCheck instanceof Response) return authCheck;

  const { payload } = authCheck;
  const { id: integrationId } = await params;

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        companyId: payload.companyId, // Tenant isolation check
      }
    });
    console.log("ASSET DISCOVERY DEBUG:", {
      integrationId,
      companyId: payload.companyId,
      foundIntegration: !!integration,
      provider: integration?.provider,
      status: integration?.status,
      isActive: integration?.isActive,
    });
    if (!integration) {
      return new NextResponse(JSON.stringify({ error: "Integration not found" }), { status: 404 });
    }

    if (integration.provider !== "META") {
      return new NextResponse(JSON.stringify({ error: "Assets discovery only supported for Meta integrations currently" }), { status: 400 });
    }

    // Get decrypted credentials safely internally
    const credentials = await getIntegrationCredentials(integrationId, payload.companyId!);
    if (!credentials) {
      return new NextResponse(JSON.stringify({ error: "No credentials found" }), { status: 400 });
    }

    const accessToken = credentials.accessToken || credentials.access_token;
    if (!accessToken) {
      return new NextResponse(JSON.stringify({ error: "No Meta access token available" }), { status: 400 });
    }

    const discoveredAssets = await discoverMetaAssets(accessToken);

    // Strip sensitive tokens from being returned to the browser!
    const safeAssets = discoveredAssets.map(asset => ({
      type: asset.type,
      externalId: asset.externalId,
      name: asset.name,
      metadata: asset.metadata
    }));

    return NextResponse.json({ assets: safeAssets });
  } catch (error: any) {
    console.error("Asset discovery error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuthenticatedUser(request, ["ADMIN", "SUPER_ADMIN"]);
  if (authCheck instanceof Response) return authCheck;

  const { payload } = authCheck;
  const { id: integrationId } = await params;

  try {
    const body = await request.json();
    const { assets } = body; // Array of { externalId, type, name, metadata }

    if (!assets || !Array.isArray(assets)) {
      return new NextResponse(JSON.stringify({ error: "Invalid assets array" }), { status: 400 });
    }

    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        companyId: payload.companyId,
      }
    });

    if (!integration) {
      return new NextResponse(JSON.stringify({ error: "Integration not found" }), { status: 404 });
    }

    const credentials = await getIntegrationCredentials(
      integrationId,
      payload.companyId!
    );

    if (!credentials) {
      return NextResponse.json(
        { error: "No Meta credentials found" },
        { status: 400 }
      );
    }

    const accessToken =
      credentials.accessToken || credentials.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No Meta access token available" },
        { status: 400 }
      );
    }

    const savedAssets = await saveMetaAssets({
      integrationId: integration.id,
      companyId: integration.companyId,
      provider: integration.provider,
      assets,
      accessToken,
    });

    return NextResponse.json({ success: true, assets: savedAssets });
  } catch (error: any) {
    console.error("Asset connection error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
