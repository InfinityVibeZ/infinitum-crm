import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getProvider } from "@/lib/integrations/provider-registry";
import jwt from "jsonwebtoken";
import { getApiKey } from "@/lib/config";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intent = url.searchParams.get("intent") || "facebook";

  const authCheck = await requireAuthenticatedUser(request, ["ADMIN", "SUPER_ADMIN"]);
  if (authCheck instanceof Response) return authCheck;

  const { payload, user } = authCheck;
  if (!user.companyId) {
    return new NextResponse(JSON.stringify({ error: "User has no associated company" }), { status: 400 });
  }

  try {
    const provider = getProvider("META");

    // Canonical redirect URI resolution
    const dbUri = await getApiKey("META_REDIRECT_URI");
    let redirectUri = dbUri;
    console.log("[IG-OAUTH-REDIRECT-CHECK] AUTH START", {
      redirectUri,
      length: redirectUri.length,
      json: JSON.stringify(redirectUri),
    });
    let redirectUriSource = "DB";
    if (!redirectUri) {
      const url = new URL(request.url);
      const protocol = url.protocol.replace(':', '');
      const host = url.host;
      redirectUri = `${protocol}://${host}/api/settings/integrations/meta/callback`;
      redirectUriSource = "fallback";
    }

    console.log("[RUNTIME DIAGNOSTIC] auth/route.ts:", {
      intent,
      redirectUri,
      redirectUriLength: redirectUri?.length,
      redirectUriSource,
      isExpected: redirectUri === "https://localhost:3000/api/settings/integrations/meta/callback"
    });

    // Generate OAuth State signed with JWT to prevent CSRF and cross-tenant attacks
    const statePayload = {
      companyId: user.companyId,
      userId: payload.userId,
      intent,
      exp: Math.floor(Date.now() / 1000) + (60 * 15), // 15 mins expiry
    };
    const stateToken = jwt.sign(statePayload, JWT_SECRET);

    // Get Auth URL from provider
    // In our provider we just encoded a dummy JSON state, let's override that URL generation behavior 
    // or we can pass our JWT as the state.
    // The provider's getAuthorizationUrl currently generates its own base64 state, which isn't safe.
    // Let's modify the URL here to use our secure state instead.
    const config = await prisma.platformMetaConfiguration.findFirst();
    if (!config || !config.enabled) throw new Error("META_APP_ID is not configured");
    const appId = config.appId;

    const configId =
      intent === "instagram"
        ? config.instagramConfigId
        : config.facebookConfigId;
    console.log(`[META OAUTH] Intent: ${intent}, Selected Config ID: ${configId}`);

    let authUrl = "";
    if (intent === "instagram") {
      const instagramAppId = config.instagramAppId;

      console.log("[META OAUTH] Instagram configuration:", {
        instagramAppId,
        instagramConfigId: config.instagramConfigId,
        redirectUri,
      });

      const scopes = [
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
        "instagram_business_content_publish",
      ].join(",");

      authUrl =
        `https://www.instagram.com/oauth/authorize` +
        `?client_id=${instagramAppId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(stateToken)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code`;
    } else {
      const scopesList = ["pages_show_list"];
      const scopes = scopesList.join(",");
      authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateToken}&scope=${scopes}&response_type=code`;
      if (configId) {
        authUrl += `&config_id=${configId}`;
      }
    }

    return NextResponse.json({ url: authUrl });
  } catch (error: any) {
    console.error("Meta auth init error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
