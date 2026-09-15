import { NextResponse } from "next/server";
import { getProvider } from "@/lib/integrations/provider-registry";
import { createIntegration } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit";
import jwt from "jsonwebtoken";
import { getApiKey } from "@/lib/config";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function GET(request: Request) {
  console.log('[IG-OAUTH-TRACE] callback_route_entered');
  console.log("=== META CALLBACK HIT ===");
  console.log(`URL: ${request.url}`);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const error_description = url.searchParams.get("error_description");
  console.log('[IG-OAUTH-TRACE] query_params', { code: !!code, state: !!state, error: !!error, error_description: !!error_description });

  const host = request.headers.get("host");
  // The host headers aren't used for redirectUri resolution anymore, but keep for redirectTarget
  const protocol = request.url.startsWith("https") ? "https" : "http";
  const redirectTarget = `${protocol}://${host}/settings/integrations`;
  console.log(`[Instagram OAuth] callback reached`);
  console.log(`[Instagram OAuth] code present: ${!!code}`);
  console.log(`[Instagram OAuth] state present: ${!!state}`);

  const popupResponse = (type: string, errMessage?: string) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>OAuth Callback</title></head>
        <body>
          <p>Completing authentication...</p>
          <script>
            console.log("[Instagram OAuth] popup HTML response rendering. Type:", "${type}");
            if (window.opener) {
              console.log("[Instagram OAuth] success message sent");
              window.opener.postMessage({
                type: "${type}",
                error: ${errMessage ? JSON.stringify(errMessage) : "undefined"}
              }, window.location.origin);
              // Small delay to ensure postMessage fires before close
              setTimeout(() => { window.close(); }, 50);
            } else {
              console.log("No window.opener found, falling back to redirect");
              window.location.href = "${redirectTarget}${type === 'META_OAUTH_SUCCESS' ? '?success=true' : `?error=${errMessage ? encodeURIComponent(errMessage) : 'OAuth failed'}`}";
            }
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  };

  if (error) {
    console.error(`Meta OAuth Error: ${error} - ${error_description}`);
    return popupResponse("META_OAUTH_ERROR", error_description || "Meta OAuth failed");
  }

  if (!code || !state) {
    return popupResponse("META_OAUTH_ERROR", "MissingCodeOrState");
  }

  try {
    // 1. Verify State Token
    const decodedState = jwt.verify(state, JWT_SECRET) as { companyId: string; userId: string; intent?: string };
    const { companyId, userId, intent } = decodedState;
    console.log('[IG-OAUTH-TRACE] decoded_intent', { intent });

    if (!companyId) throw new Error("Invalid state payload");

    // 2. Exchange token
    const provider = getProvider("META");
    console.log('[IG-OAUTH-TRACE] provider_selected', { provider: "META" });

    // Canonical redirect URI resolution
    const dbUri = await getApiKey("META_REDIRECT_URI");
    let redirectUri = dbUri;
    console.log("[IG-OAUTH-REDIRECT-CHECK] CALLBACK", {
      redirectUri,
      length: redirectUri.length,
      json: JSON.stringify(redirectUri),
    });
    let redirectUriSource = "DB";
    if (!redirectUri) {
      const url = new URL(request.url);
      const reqProtocol = url.protocol.replace(':', '');
      const reqHost = url.host;
      redirectUri = `${reqProtocol}://${reqHost}/api/settings/integrations/meta/callback`;
      redirectUriSource = "fallback";
    }
    console.log("[RUNTIME DIAGNOSTIC] callback/route.ts:", {
      intent,
      redirectUri,
      redirectUriLength: redirectUri?.length,
      redirectUriSource,
      isExpected: redirectUri === "https://localhost:3000/api/settings/integrations/meta/callback"
    });
    console.log(`[Instagram OAuth] Using redirectUri: ${redirectUri}`);

    console.log(`[Instagram OAuth] token exchange started`);
    const credentials = await provider.exchangeToken(code, redirectUri, intent);
    console.log(`[Instagram OAuth] token exchange succeeded`);
    console.log('[IG-OAUTH-TRACE] credentials_meta', { intent: credentials.intent, tokenType: credentials.tokenType, expiresIn: credentials.expiresIn });

    // 3. Get Account metadata
    console.log('[IG-OAUTH-TRACE] fetching_account_metadata');
    const accountInfo = await provider.getAccountMetadata!(credentials);
    const externalId = accountInfo.id;
    const displayName = accountInfo.name;
    console.log('[IG-OAUTH-TRACE] account_info', { externalId, displayName });

    // 4. Save Integration securely
    const dbProvider = intent === "instagram" ? "INSTAGRAM" : "META";

    console.log("[IG-OAUTH-TRACE] integration_save_start", {
      dbProvider,
      companyId,
      externalId,
    });
    // Check if it already exists for this tenant
    const existing = await prisma.integration.findFirst({
      where: {
        provider: dbProvider,
        companyId: companyId,
        externalId: externalId
      }
    });

    if (existing) {
      // Reconnect/Update
      const updatedIntegration = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          status: "CONNECTED",
          displayName,
          isActive: true
        }
      });
      console.log('[IG-OAUTH-TRACE] integration_update_success', { integrationId: updatedIntegration.id, provider: dbProvider, externalId, companyId });

      // We'd update credentials here ideally, but createIntegration handles new ones.
      // For simplicity, if it exists, let's just log and update the Integration.
      // Updating credentials securely requires the encryption method which is in lib/integrations.ts
      // But lib/integrations doesn't have an updateCredentials method yet.
      // So we will just use the standard createIntegration which creates or overwrites based on unique constraint?
      // Wait, createIntegration generates a new one. 
    }

    // Let's use the actual createIntegration method which is safe if it doesn't exist, but it might throw if it exists due to unique constraint.
    // Actually, createIntegration in lib/integrations.ts doesn't upsert.
    // Let's just do upsert logic manually here.

    // We need encryption logic.
    // I will dynamically import the encrypt function or just use createIntegration for new ones.
    const { encrypt } = await import("@/lib/encryption");

    const expiresAt = credentials.expiresIn ? new Date(Date.now() + credentials.expiresIn * 1000) : null;
    const encryptedData = encrypt(JSON.stringify(credentials));

    if (existing) {
      await prisma.integrationCredential.upsert({
        where: { integrationId: existing.id },
        update: { encryptedData, expiresAt },
        create: { integrationId: existing.id, encryptedData, expiresAt }
      });
    } else {
      const createdIntegration = await prisma.integration.create({
        data: {
          companyId,
          provider: dbProvider,
          type: "OAUTH",
          externalId,
          displayName,
          status: "CONNECTED",
          credentials: {
            create: {
              encryptedData,
              expiresAt
            }
          }
        }
      });
      console.log('[IG-OAUTH-TRACE] integration_create_success', { integrationId: createdIntegration.id, provider: dbProvider, externalId, companyId });
    }

    console.log('[IG-OAUTH-TRACE] integration_saved');

    // 5. Audit Logging
    await logAuditEvent({
      action: "INTEGRATION_CONNECTED",
      category: "Settings",
      severity: "SUCCESS",
      actorName: "System", // Or fetch user
      actorEmail: "",
      actorRole: "ADMIN",
      summary: `Meta account ${displayName} connected successfully`,
    });

    return popupResponse("META_OAUTH_SUCCESS");
  } catch (error: any) {
    console.error(`Meta OAuth Token Exchange Error:`, error.message);

    let errorType = "META_OAUTH_ERROR";
    let errorMessage = error.message || "Failed to exchange token";

    if (error.code === "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED" || error.message === "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED") {
      errorType = "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED";
      errorMessage = "Instagram Professional Account Required";
    }

    console.log("[IG-OAUTH-TRACE] final_redirect_error", {
      errorType,
      errorMessage,
    });

    return popupResponse(errorType, errorMessage);
  }
}
