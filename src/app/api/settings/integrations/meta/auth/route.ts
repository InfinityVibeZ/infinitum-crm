import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getProvider } from "@/lib/integrations/provider-registry";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function GET(request: Request) {
  const requestStartedAt = Date.now();

  console.log("====================================================");
  console.log("[META-OAUTH] AUTH ROUTE START");
  console.log("====================================================");

  try {
    // ============================================================
    // 1. REQUEST INFORMATION
    // ============================================================

    const url = new URL(request.url);

    const intent = url.searchParams.get("intent") || "facebook";

    console.log("[META-OAUTH] REQUEST", {
      method: request.method,
      requestUrl: request.url,
      origin: url.origin,
      protocol: url.protocol,
      hostname: url.hostname,
      host: url.host,
      pathname: url.pathname,
      intent,
    });

    // ============================================================
    // 2. AUTHENTICATION
    // ============================================================

    console.log("[META-OAUTH] AUTHENTICATION CHECK START", {
      intent,
      origin: url.origin,
    });

    const authCheck = await requireAuthenticatedUser(
      request,
      ["ADMIN", "SUPER_ADMIN"]
    );

    if (authCheck instanceof Response) {
      console.error(
        "[META-OAUTH] AUTHENTICATION FAILED",
        {
          intent,
          origin: url.origin,
          status: authCheck.status,
        }
      );

      return authCheck;
    }

    const { payload, user } = authCheck;

    console.log("[META-OAUTH] AUTHENTICATION SUCCESS", {
      intent,
      userIdPresent: !!payload?.userId,
      companyIdPresent: !!user?.companyId,
      role: user?.role,
    });

    // ============================================================
    // 3. TENANT VALIDATION
    // ============================================================

    if (!user.companyId) {
      console.error(
        "[META-OAUTH] TENANT VALIDATION FAILED",
        {
          intent,
          userIdPresent: !!payload?.userId,
        }
      );

      return new NextResponse(
        JSON.stringify({
          error: "User has no associated company",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("[META-OAUTH] TENANT VALIDATION SUCCESS", {
      intent,
      companyIdPresent: true,
    });

    // ============================================================
    // 4. PROVIDER
    // ============================================================

    const provider = getProvider("META");

    console.log("[META-OAUTH] PROVIDER SELECTED", {
      provider: "META",
      intent,
    });

    // ============================================================
    // 5. REDIRECT URI
    // ============================================================
    //
    // IMPORTANT:
    //
    // We intentionally DO NOT use:
    //
    // META_REDIRECT_URI
    // META_FACEBOOK_REDIRECT_URI
    //
    // The redirect URI is derived from the CURRENT REQUEST ORIGIN.
    //
    // localhost:
    // https://localhost:3000
    // ->
    // https://localhost:3000/api/settings/integrations/meta/callback
    //
    // Cloudflare:
    // https://lung-ppc-nest-andy.trycloudflare.com
    // ->
    // https://lung-ppc-nest-andy.trycloudflare.com/api/settings/integrations/meta/callback
    //
    // ============================================================

    const requestUrl = new URL(request.url);

    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");

    const host =
      forwardedHost ||
      request.headers.get("host") ||
      requestUrl.host;

    const protocol =
      forwardedProto ||
      requestUrl.protocol.replace(":", "");

    const redirectUri =
      `${protocol}://${host}/api/settings/integrations/meta/callback`;

    console.log("[META-OAUTH] PUBLIC ORIGIN DEBUG:", {
      requestUrl: request.url,
      requestOrigin: requestUrl.origin,

      hostHeader: request.headers.get("host"),
      forwardedHost,
      forwardedProto,

      resolvedHost: host,
      resolvedProtocol: protocol,
      redirectUri,
    });
    const redirectUriSource = "request-origin";

    console.log("[META-OAUTH] REDIRECT URI RESOLUTION", {
      intent,
      requestOrigin: requestUrl.origin,
      requestProtocol: requestUrl.protocol,
      requestHostname: requestUrl.hostname,
      requestHost: requestUrl.host,
      calculatedProtocol: protocol,
      calculatedHost: host,
      redirectUri,
      redirectUriSource,
    });

    // ============================================================
    // 6. STATE TOKEN
    // ============================================================

    const statePayload = {
      companyId: user.companyId,
      userId: payload.userId,
      intent,
      exp:
        Math.floor(Date.now() / 1000) +
        60 * 15,
    };

    console.log("[META-OAUTH] STATE PAYLOAD", {
      companyIdPresent: !!statePayload.companyId,
      userIdPresent: !!statePayload.userId,
      intent: statePayload.intent,
      expiresInMinutes: 15,
    });

    const stateToken = jwt.sign(
      statePayload,
      JWT_SECRET
    );

    console.log("[META-OAUTH] STATE TOKEN CREATED", {
      statePresent: !!stateToken,
      stateLength: stateToken.length,
      intent,
    });

    // ============================================================
    // 7. PLATFORM META CONFIGURATION
    // ============================================================

    console.log(
      "[META-OAUTH] LOADING PLATFORM META CONFIGURATION"
    );

    const config =
      await prisma.platformMetaConfiguration.findFirst();

    if (!config) {
      console.error(
        "[META-OAUTH] PLATFORM META CONFIGURATION NOT FOUND",
        {
          intent,
        }
      );

      throw new Error(
        "META_APP_ID is not configured"
      );
    }

    if (!config.enabled) {
      console.error(
        "[META-OAUTH] PLATFORM META CONFIGURATION DISABLED",
        {
          intent,
        }
      );

      throw new Error(
        "META_APP_ID is not configured"
      );
    }

    const appId = config.appId;

    console.log(
      "[META-OAUTH] PLATFORM META CONFIGURATION LOADED",
      {
        intent,
        enabled: config.enabled,
        appIdPresent: !!config.appId,
        appIdLength: config.appId?.length,
        facebookConfigIdPresent:
          !!config.facebookConfigId,
        instagramConfigIdPresent:
          !!config.instagramConfigId,
        instagramAppIdPresent:
          !!config.instagramAppId,
      }
    );

    // ============================================================
    // 8. CONFIG ID
    // ============================================================

    const configId =
      intent === "instagram"
        ? config.instagramConfigId
        : config.facebookConfigId;

    console.log(
      "[META-OAUTH] CONFIGURATION SELECTION",
      {
        intent,
        configIdPresent: !!configId,
        configId,
        selectedFor:
          intent === "instagram"
            ? "INSTAGRAM"
            : "FACEBOOK",
      }
    );

    // ============================================================
    // 9. BUILD OAUTH URL
    // ============================================================

    let authUrl = "";

    // ============================================================
    // INSTAGRAM
    // ============================================================
    //
    // DO NOT CHANGE THIS FLOW.
    //
    // ============================================================

    if (intent === "instagram") {
      const instagramAppId =
        config.instagramAppId;

      console.log(
        "[META-OAUTH] INSTAGRAM FLOW START",
        {
          instagramAppIdPresent:
            !!instagramAppId,
          instagramAppIdLength:
            instagramAppId?.length,
          instagramConfigId:
            config.instagramConfigId,
          redirectUri,
        }
      );

      const scopes = [
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
        "instagram_business_content_publish",
      ].join(",");

      console.log(
        "[META-OAUTH] INSTAGRAM SCOPES",
        {
          scopes,
          scopeCount: scopes.split(",").length,
        }
      );

      authUrl =
        `https://www.instagram.com/oauth/authorize` +
        `?client_id=${instagramAppId}` +
        `&redirect_uri=${encodeURIComponent(
          redirectUri
        )}` +
        `&state=${encodeURIComponent(
          stateToken
        )}` +
        `&scope=${encodeURIComponent(
          scopes
        )}` +
        `&response_type=code`;

      console.log(
        "[META-OAUTH] INSTAGRAM AUTH URL CREATED",
        {
          origin:
            new URL(authUrl).origin,
          pathname:
            new URL(authUrl).pathname,
          clientIdPresent:
            !!new URL(authUrl).searchParams.get(
              "client_id"
            ),
          redirectUri:
            new URL(authUrl).searchParams.get(
              "redirect_uri"
            ),
          scope:
            new URL(authUrl).searchParams.get(
              "scope"
            ),
          responseType:
            new URL(authUrl).searchParams.get(
              "response_type"
            ),
          statePresent:
            !!new URL(authUrl).searchParams.get(
              "state"
            ),
        }
      );
    }

    // ============================================================
    // FACEBOOK
    // ============================================================

    else {
      console.log(
        "[META-OAUTH] FACEBOOK FLOW START",
        {
          appIdPresent: !!appId,
          appIdLength: appId?.length,
          facebookConfigId: config.facebookConfigId,
          configIdPresent: !!configId,
          redirectUri,
        }
      );

      // KEEP FACEBOOK SCOPES AS CURRENTLY CONFIGURED
      const scopesList = [
        "pages_show_list",
        "pages_read_engagement",
      ];

      const scopes =
        scopesList.join(",");

      console.log(
        "[META-OAUTH] FACEBOOK SCOPES",
        {
          scopes,
          scopeCount: scopesList.length,
        }
      );

      authUrl =
        `https://www.facebook.com/v19.0/dialog/oauth` +
        `?client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(
          redirectUri
        )}` +
        `&state=${encodeURIComponent(
          stateToken
        )}` +
        `&scope=${encodeURIComponent(
          scopes
        )}` +
        `&response_type=code`;

      if (configId) {
        authUrl +=
          `&config_id=${encodeURIComponent(
            configId
          )}`;

        console.log(
          "[META-OAUTH] FACEBOOK CONFIG ID ADDED",
          {
            configId,
          }
        );
      } else {
        console.log(
          "[META-OAUTH] FACEBOOK CONFIG ID NOT PRESENT"
        );
      }

      // ============================================================
      // SAFE FACEBOOK URL DIAGNOSTICS
      // ============================================================

      const facebookAuthUrl =
        new URL(authUrl);

      console.log(
        "[META-OAUTH] FACEBOOK AUTH URL CREATED",
        {
          origin:
            facebookAuthUrl.origin,

          pathname:
            facebookAuthUrl.pathname,

          clientIdPresent:
            !!facebookAuthUrl.searchParams.get(
              "client_id"
            ),

          clientIdLength:
            facebookAuthUrl.searchParams.get(
              "client_id"
            )?.length,

          redirectUri:
            facebookAuthUrl.searchParams.get(
              "redirect_uri"
            ),

          scope:
            facebookAuthUrl.searchParams.get(
              "scope"
            ),

          responseType:
            facebookAuthUrl.searchParams.get(
              "response_type"
            ),

          configId:
            facebookAuthUrl.searchParams.get(
              "config_id"
            ),

          statePresent:
            !!facebookAuthUrl.searchParams.get(
              "state"
            ),

          stateLength:
            facebookAuthUrl.searchParams.get(
              "state"
            )?.length,
        }
      );

      // ============================================================
      // CRITICAL DIAGNOSTIC
      // ============================================================

      const generatedRedirectUri =
        facebookAuthUrl.searchParams.get(
          "redirect_uri"
        );

      console.log("[META-OAUTH] FACEBOOK REDIRECT URI FINAL CHECK", {
        internalRequestOrigin: requestUrl.origin,
        internalRequestHost: requestUrl.host,

        forwardedHost: request.headers.get("x-forwarded-host"),
        forwardedProto: request.headers.get("x-forwarded-proto"),

        generatedRedirectUri: redirectUri,

        containsLocalhost: redirectUri.includes("localhost"),
        containsCloudflare: redirectUri.includes("trycloudflare.com"),
      });
    }

    // ============================================================
    // 10. FINAL RESPONSE
    // ============================================================

    console.log(
      "[META-OAUTH] AUTH ROUTE COMPLETE",
      {
        intent,
        redirectUri,
        redirectUriSource,
        authUrlPresent: !!authUrl,
        authUrlLength: authUrl.length,
        durationMs:
          Date.now() - requestStartedAt,
      }
    );

    console.log(
      "===================================================="
    );

    return NextResponse.json({
      url: authUrl,
    });
  } catch (error: any) {
    console.error(
      "===================================================="
    );

    console.error(
      "[META-OAUTH] AUTH INIT ERROR",
      {
        errorName:
          error?.name,
        errorMessage:
          error?.message,
        durationMs:
          Date.now() - requestStartedAt,
      }
    );

    console.error(
      "===================================================="
    );

    return new NextResponse(
      JSON.stringify({
        error:
          error?.message ||
          "Failed to initialize Meta OAuth",
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }
}