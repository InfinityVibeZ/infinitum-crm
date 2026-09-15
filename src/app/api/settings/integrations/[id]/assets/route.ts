import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIntegrationCredentials } from "@/lib/integrations";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authCheck = await requireAuthenticatedUser(request, ["ADMIN", "SUPER_ADMIN"]);
  if (authCheck instanceof Response) return authCheck;

  const { payload } = authCheck;
  const integrationId = params.id;

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        companyId: payload.companyId, // Tenant isolation check
      }
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

    // 1. Fetch Pages
    const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`);
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok) {
      throw new Error(pagesData.error?.message || "Failed to fetch Facebook Pages");
    }

    const discoveredAssets = [];

    // Map Facebook Pages
    for (const page of pagesData.data || []) {
      discoveredAssets.push({
        type: "PAGE",
        externalId: page.id,
        name: page.name,
        metadata: { pageAccessToken: page.access_token } // Securely returned for connecting only, we'll strip tokens before returning to client ideally, but we need them in POST? Better to not return tokens to client! 
        // Let's strip the pageAccessToken from the response to prevent token leakage to the client.
        // We will fetch the token again during POST or just rely on user token.
      });

      // If page has an attached Instagram Business account, map it too
      if (page.instagram_business_account?.id) {
        // Fetch IG details
        const igResponse = await fetch(`https://graph.facebook.com/v19.0/${page.instagram_business_account.id}?fields=id,username,name&access_token=${accessToken}`);
        if (igResponse.ok) {
          const igData = await igResponse.json();
          discoveredAssets.push({
            type: "INSTAGRAM",
            externalId: igData.id,
            name: igData.name || igData.username || "Instagram Account",
            metadata: { username: igData.username, linkedPageId: page.id }
          });
        }
      }
    }

    // Strip sensitive tokens from being returned to the browser!
    const safeAssets = discoveredAssets.map(asset => ({
      type: asset.type,
      externalId: asset.externalId,
      name: asset.name,
      metadata: { ...asset.metadata, pageAccessToken: undefined }
    }));

    return NextResponse.json({ assets: safeAssets });
  } catch (error: any) {
    console.error("Asset discovery error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authCheck = await requireAuthenticatedUser(request, ["ADMIN", "SUPER_ADMIN"]);
  if (authCheck instanceof Response) return authCheck;

  const { payload } = authCheck;
  const integrationId = params.id;

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

    const savedAssets = [];

    // Safely upsert each asset to avoid unique constraint violations on re-saves
    for (const asset of assets) {
      const saved = await prisma.integrationAsset.upsert({
        where: {
          integrationId_assetType_externalId: {
            integrationId: integration.id,
            assetType: asset.type,
            externalId: asset.externalId
          }
        },
        update: {
          name: asset.name,
          metadata: asset.metadata || {},
          isActive: true
        },
        create: {
          integrationId: integration.id,
          companyId: integration.companyId,
          provider: integration.provider,
          assetType: asset.type,
          externalId: asset.externalId,
          name: asset.name,
          metadata: asset.metadata || {},
          isActive: true
        }
      });
      savedAssets.push(saved);
    }

    return NextResponse.json({ success: true, assets: savedAssets });
  } catch (error: any) {
    console.error("Asset connection error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
