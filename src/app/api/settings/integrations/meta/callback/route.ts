import { NextResponse } from "next/server";
import { getProvider } from "@/lib/integrations/provider-registry";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit";
import {
  discoverMetaAssets,
  saveMetaAssets,
} from "@/lib/integrations/meta-assets";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function GET(request: Request) {
  console.log("========== META CALLBACK DEBUG ==========");

  console.log("[META-CALLBACK] request.url:", request.url);

  const callbackUrl = new URL(request.url);

  console.log("[META-CALLBACK] URL:", {
    origin: callbackUrl.origin,
    host: callbackUrl.host,
    pathname: callbackUrl.pathname,
    search: callbackUrl.search,
  });

  console.log("[META-CALLBACK] PARAMS:", {
    hasCode: callbackUrl.searchParams.has("code"),
    hasState: callbackUrl.searchParams.has("state"),
    hasError: callbackUrl.searchParams.has("error"),
    error: callbackUrl.searchParams.get("error"),
    errorCode: callbackUrl.searchParams.get("error_code"),
    errorReason: callbackUrl.searchParams.get("error_reason"),
    errorDescription: callbackUrl.searchParams.get("error_description"),
  });

  console.log("=========================================");
  console.log("[META-OAUTH-TRACE] callback_route_entered");
  console.log("=== META CALLBACK HIT ===");

  // Do NOT log the complete request URL here in production.
  // It contains the OAuth code/state.
  console.log("[META-CALLBACK] Callback request received");

  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const error_description = url.searchParams.get(
    "error_description"
  );

  console.log("[META-OAUTH-TRACE] query_params", {
    code: !!code,
    state: !!state,
    error: !!error,
    error_description: !!error_description,
  });

  /*
   * Resolve the public CRM origin.
   *
   * Behind Cloudflare:
   *
   *
   * x-forwarded-host:
   *   lung-ppc-nest-andy.trycloudflare.com
   *
   * x-forwarded-proto:
   *   https
   *
   * Therefore redirectUri must be:
   *
   * https://lung-ppc-nest-andy.trycloudflare.com/api/settings/integrations/meta/callback
   */

  const requestUrl = new URL(request.url);

  const forwardedHost =
    request.headers.get("x-forwarded-host");

  const forwardedProto =
    request.headers.get("x-forwarded-proto");

  const host =
    forwardedHost ||
    request.headers.get("host") ||
    requestUrl.host;

  const protocol =
    forwardedProto ||
    requestUrl.protocol.replace(":", "");

  const redirectUri =
    `${protocol}://${host}/api/settings/integrations/meta/callback`;

  /*
   * Popup response helper
   *
   * The OAuth callback runs inside the popup.
   * It sends the result back to the parent CRM window.
   */
  const popupResponse = (
    type: string,
    errMessage?: string,
    successMessage?: string
  ) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Callback</title>
        </head>

        <body>
          <p>Completing authentication...</p>

          <script>
            console.log(
              "[META OAuth] popup HTML response rendering. Type:",
              ${JSON.stringify(type)}
            );

            if (window.opener) {
              console.log(
                "[META OAuth] success/error message sent"
              );

              window.opener.postMessage(
                {
                  type: ${JSON.stringify(type)},
                  error: ${
                    errMessage
                      ? JSON.stringify(errMessage)
                      : "undefined"
                  },
                  message: ${
                    successMessage
                      ? JSON.stringify(successMessage)
                      : "undefined"
                  }
                },
                window.location.origin
              );

              // Small delay to ensure postMessage fires before closing.
              setTimeout(() => {
                window.close();
              }, 50);

            } else {
              console.log(
                "No window.opener found, falling back to redirect"
              );

              window.location.href =
                ${JSON.stringify(redirectTarget)} +
                ${
                  type === "META_OAUTH_SUCCESS"
                    ? JSON.stringify(
                        `?success=true&message=${encodeURIComponent(
                          successMessage || "Integration connected successfully"
                        )}`
                      )
                    : JSON.stringify(
                        `?error=${
                          errMessage
                            ? encodeURIComponent(errMessage)
                            : "OAuth failed"
                        }`
                      )
                };
            }
          </script>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  };

  /*
   * Determine the parent CRM redirect target.
   *
   * Use the same public origin resolved above.
   */
  const redirectTarget =
    `${protocol}://${host}/settings/integrations`;

  console.log("[META-OAUTH-TRACE] redirect_target", {
    redirectTarget,
  });

  /*
   * Handle OAuth provider errors.
   */
  if (error) {
    console.error(
      `Meta OAuth Error: ${error} - ${error_description}`
    );

    return popupResponse(
      "META_OAUTH_ERROR",
      error_description || "Meta OAuth failed"
    );
  }

  /*
   * OAuth provider must return both code and state.
   */
  if (!code || !state) {
    return popupResponse(
      "META_OAUTH_ERROR",
      "MissingCodeOrState"
    );
  }

  try {
    let integrationId: string;
    /*
     * 1. Verify OAuth State Token
     *
     * The state contains:
     * - companyId
     * - userId
     * - intent
     *
     * This prevents cross-tenant OAuth callbacks.
     */
    const decodedState = jwt.verify(
      state,
      JWT_SECRET
    ) as {
      companyId: string;
      userId: string;
      intent?: string;
    };

    const {
      companyId,
      userId,
      intent,
    } = decodedState;

    console.log("[META-OAUTH-TRACE] decoded_intent", {
      intent,
    });

    if (!companyId) {
      throw new Error("Invalid state payload");
    }

    /*
     * 2. Get META provider
     */
    const provider = getProvider("META");

    console.log(
      "[META-OAUTH-TRACE] provider_selected",
      {
        provider: "META",
      }
    );

    /*
     * 3. Redirect URI diagnostic
     *
     * IMPORTANT:
     *
     * Facebook authorization used the public Cloudflare URL.
     * The token exchange MUST use the exact same redirect URI.
     *
     * Example:
     *
     * Authorization:
     * https://lung-ppc-nest-andy.trycloudflare.com/api/settings/integrations/meta/callback
     *
     * Token exchange:
     * https://lung-ppc-nest-andy.trycloudflare.com/api/settings/integrations/meta/callback
     *
    
    const redirectUriSource = forwardedHost
      ? "x-forwarded-host"
      : "request-origin";

    console.log(
      "[META-OAUTH-REDIRECT-CHECK] CALLBACK",
      {
        intent,
        redirectUri,
        source: redirectUriSource,
        requestUrl: request.url,
        host,
        protocol,
        forwardedHost,
        forwardedProto,
      }
    );

    console.log(
      "[RUNTIME DIAGNOSTIC] callback/route.ts:",
      {
        intent,
        redirectUri,
        redirectUriLength: redirectUri.length,
        redirectUriSource,
      }
    );

    /*
     * 4. Exchange OAuth authorization code for credentials.
     *
     * Intent remains unchanged:
     *
     * instagram -> Instagram OAuth flow
     * facebook  -> Facebook OAuth flow
     */
    console.log(
      `[META OAuth] Token exchange started. Intent: ${intent}`
    );

    const credentials =
      await provider.exchangeToken(
        code,
        redirectUri,
        intent
      );

    console.log(
      `[META OAuth] Token exchange succeeded. Intent: ${intent}`
    );

    console.log(
      "[META-OAUTH] REDIRECT DEBUG BEFORE TOKEN EXCHANGE:",
      {
        protocol,
        host,
        redirectUri,
        requestUrl: request.url,
        forwardedHost,
        forwardedProto,
      }
    );

    console.log(
      "[META-OAUTH-TRACE] credentials_meta",
      {
        intent: credentials.intent,
        tokenType: credentials.tokenType,
        expiresIn: credentials.expiresIn,
      }
    );

    /*
     * 5. Get connected account metadata.
     */
    console.log(
      "[META-OAUTH-TRACE] fetching_account_metadata"
    );

    const accountInfo =
      await provider.getAccountMetadata!(
        credentials
      );

    const externalId = accountInfo.id;
    const displayName = accountInfo.name;

    console.log(
      "[META-OAUTH-TRACE] account_info",
      {
        externalId,
        displayName,
      }
    );

    /*
     * 6. Determine database provider.
     *
     * Instagram stays INSTAGRAM.
     * Facebook stays META.
     */
    const dbProvider =
      intent === "instagram"
        ? "INSTAGRAM"
        : "META";

    console.log(
      "[META-OAUTH-TRACE] integration_save_start",
      {
        dbProvider,
        companyId,
        externalId,
      }
    );

    /*
     * 7. Check whether this integration already exists
     *    for this tenant.
     */
    const existing =
      await prisma.integration.findFirst({
        where: {
          provider: dbProvider,
          companyId,
          externalId,
        },
      });

    /*
     * 8. Encrypt OAuth credentials.
     */
    const { encrypt } =
      await import("@/lib/encryption");

    const expiresAt =
      credentials.expiresIn
        ? new Date(
            Date.now() +
              credentials.expiresIn * 1000
          )
        : null;

    const encryptedData =
      encrypt(JSON.stringify(credentials));

    /*
     * 9. Update existing integration
     *    or create a new integration.
     */
    if (existing) {
      const updatedIntegration =
        await prisma.integration.update({
          where: {
            id: existing.id,
          },
          data: {
            status: "CONNECTED",
            displayName,
            isActive: true,
              lastSyncAt: new Date(),
          },
        });

      console.log(
        "[META-OAUTH-TRACE] integration_update_success",
        {
          integrationId:
            updatedIntegration.id,
          provider: dbProvider,
          externalId,
          companyId,
        }
      );

      /*
       * Update encrypted credentials as well.
       */
      await prisma.integrationCredential.upsert({
        where: {
          integrationId: existing.id,
        },
        update: {
          encryptedData,
          expiresAt,
        },
        create: {
          integrationId: existing.id,
          encryptedData,
          expiresAt,
        },
      });

      console.log(
        "[META-OAUTH-TRACE] credentials_update_success",
        {
          integrationId: existing.id,
        }
      );

      integrationId = existing.id;

    } else {
      const createdIntegration =
        await prisma.integration.create({
          data: {
            companyId,
            provider: dbProvider,
            type: "OAUTH",
            externalId,
            displayName,
            status: "CONNECTED",
              lastSyncAt: new Date(),

            credentials: {
              create: {
                encryptedData,
                expiresAt,
              },
            },
          },
        });

      console.log(
        "[META-OAUTH-TRACE] integration_create_success",
        {
          integrationId:
            createdIntegration.id,
          provider: dbProvider,
          externalId,
          companyId,
        }
      );

      integrationId = createdIntegration.id;
    }

    console.log(
      "[META-OAUTH-TRACE] integration_saved"
    );

    let successMessage = `${intent === "instagram" ? "Instagram" : "Facebook"} connected successfully!`;

    if (intent === "facebook") {
      const facebookAccessToken =
        credentials.accessToken || credentials.access_token;

      if (!facebookAccessToken) {
        throw new Error("No Meta access token available");
      }

      const pageAssets = (await discoverMetaAssets(
        facebookAccessToken,
        false
      )).filter((asset) => asset.type === "PAGE");

      await saveMetaAssets({
        integrationId,
        companyId,
        provider: dbProvider,
        assets: pageAssets,
        accessToken: facebookAccessToken,
      });

      if (pageAssets.length === 0) {
        throw new Error("No Facebook Pages were shared with this connection");
      }

      const pageNames = pageAssets.map((asset) => asset.name);
      const facebookDisplayName =
        pageNames.length === 1
          ? pageNames[0]
          : `${pageNames.length} Facebook Pages`;

      await prisma.integration.update({
        where: { id: integrationId },
        data: { displayName: facebookDisplayName },
      });

      successMessage =
        pageNames.length === 1
          ? `Facebook Page "${pageNames[0]}" connected successfully!`
          : `Facebook Pages ${pageNames.map((name) => `"${name}"`).join(", ")} connected successfully!`;
    }

    /*
     * 10. Audit Logging
     */
    await logAuditEvent({
      action: "INTEGRATION_CONNECTED",
      category: "Settings",
      severity: "SUCCESS",
      actorName: "System",
      actorEmail: "",
      actorRole: "ADMIN",
      summary:
        `Meta account ${displayName} connected successfully`,
    });

    /*
     * 11. Notify parent window.
     */
    return popupResponse(
      "META_OAUTH_SUCCESS",
      undefined,
      successMessage
    );

  } catch (error: any) {
    console.error(
      "Meta OAuth Token Exchange Error:",
      error?.message || error
    );

    let errorType =
      "META_OAUTH_ERROR";

    let errorMessage =
      error?.message ||
      "Failed to exchange token";

    /*
     * Preserve the existing Instagram-specific
     * professional-account handling.
     */
    if (
      error?.code ===
        "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED" ||
      error?.message ===
        "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED"
    ) {
      errorType =
        "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED";

      errorMessage =
        "Instagram Professional Account Required";
    }

    console.log(
      "[META-OAUTH-TRACE] final_redirect_error",
      {
        errorType,
        errorMessage,
      }
    );

    return popupResponse(
      errorType,
      errorMessage
    );
  }
}