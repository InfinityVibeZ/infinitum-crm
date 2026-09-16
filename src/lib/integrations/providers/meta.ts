import { IntegrationProvider, NormalizedWebhookEvent } from "../provider-registry";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import crypto from "crypto";

async function getMetaPlatformConfig() {
  const config = await prisma.platformMetaConfiguration.findFirst({
    where: {
      enabled: true,
    },
  });

  if (!config) {
    throw new Error(
      "Meta integration is not configured or disabled on this platform"
    );
  }

  console.log("[META CONFIG]", {
    appId: config.appId,
    hasMetaSecret: !!config.encryptedAppSecret,

    instagramAppId: config.instagramAppId || "",
    hasInstagramSecret: !!config.encryptedInstagramAppSecret,

    instagramConfigId: config.instagramConfigId,
    facebookConfigId: config.facebookConfigId,
  });

  return {
    appId: config.appId,

    appSecret: config.encryptedAppSecret
      ? decrypt(config.encryptedAppSecret)
      : "",

    instagramAppId: config.instagramAppId || "",

    instagramAppSecret: config.encryptedInstagramAppSecret
      ? decrypt(config.encryptedInstagramAppSecret)
      : "",

    instagramConfigId: config.instagramConfigId,

    facebookConfigId: config.facebookConfigId,

    webhookVerifyToken: config.encryptedWebhookVerifyToken
      ? decrypt(config.encryptedWebhookVerifyToken)
      : "",
  };
}
/**
 * Fetches the Instagram profile for a message sender.
 *
 * This uses the access token belonging to the tenant's connected
 * Instagram Professional account.
 *
 * IMPORTANT:
 * - The access token is never returned.
 * - Only public/profile identity fields are returned.
 * - Failure is handled by the caller so webhook processing is not
 *   blocked by profile enrichment.
 */
export async function getInstagramUserProfile(
  credentials: any,
  instagramUserId: string
): Promise<{
  id: string;
  username?: string;
  name?: string;
} | null> {
  const accessToken =
    credentials?.accessToken ||
    credentials?.access_token;

  if (!accessToken || !instagramUserId) {
    return null;
  }

  try {
    const url =
      `https://graph.instagram.com/v19.0/${encodeURIComponent(
        instagramUserId
      )}` +
      `?fields=id,username,name` +
      `&access_token=${encodeURIComponent(accessToken)}`;

    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok) {
      console.warn("[Instagram Profile] Profile lookup failed:", {
        status: response.status,
        userId: instagramUserId,
        errorCode: data?.error?.code ?? data?.code ?? null,
        errorType: data?.error?.type ?? null,
        message: data?.error?.message ?? data?.error_message ?? null,
      });

      return null;
    }

    return {
      id: data?.id || instagramUserId,
      username:
        typeof data?.username === "string"
          ? data.username
          : undefined,
      name:
        typeof data?.name === "string"
          ? data.name
          : undefined,
    };
  } catch (error) {
    console.warn("[Instagram Profile] Lookup exception:", {
      userId: instagramUserId,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return null;
  }
}

export const metaProvider: IntegrationProvider = {
  id: "META",

  getAuthorizationUrl: async (
    companyId: string,
    redirectUri: string,
    intent?: string
  ) => {
    const config = await getMetaPlatformConfig();

    const isInstagram = intent === "instagram";

    /*
     * Instagram Login uses the dedicated Instagram App ID.
     *
     * Current platform configuration:
     * Meta/Facebook App ID = 1837831970716360
     *
     * The Prisma model currently does not contain an instagramAppId
     * column, so the Instagram App ID is kept explicit here temporarily.
     */
    const appId = isInstagram
      ? config.instagramAppId
      : config.appId;

    if (!appId) {
      throw new Error(
        isInstagram
          ? "INSTAGRAM_APP_ID is not configured"
          : "META_APP_ID is not configured"
      );
    }

    /*
     * ============================================================
     * INSTAGRAM LOGIN
     * ============================================================
     *
     * Instagram OAuth must use the Instagram App ID.
     */
    if (isInstagram) {
      const scopes = [
        "instagram_business_basic",
        "instagram_business_manage_comments",
        "instagram_business_manage_messages",
        "instagram_business_content_publish",
      ].join(",");

      const state = Buffer.from(
        JSON.stringify({
          companyId,
          intent: "instagram",
          ts: Date.now(),
        })
      ).toString("base64");

      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes,
        state,
      });

      const authorizationUrl =
        `https://www.instagram.com/oauth/authorize?${params.toString()}`;

      console.log("[IG-OAUTH-FIX] Authorization URL generated:", {
        intent,
        appIdPresent: !!appId,
        appIdLength: appId.length,
        redirectUri,
        scopes,
        host: "www.instagram.com",
        path: "/oauth/authorize",
      });

      return authorizationUrl;
    }

    /*
     * ============================================================
     * FACEBOOK LOGIN
     * ============================================================
     *
     * Facebook continues to use the normal Meta appId.
     */
    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_messages",
      "pages_messaging",
    ].join(",");

    const state = Buffer.from(
      JSON.stringify({
        companyId,
        intent: "facebook",
        ts: Date.now(),
      })
    ).toString("base64");

    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
    });

    const authorizationUrl =
      `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;

    console.log("[META-OAUTH] Facebook authorization URL generated:", {
      appIdPresent: !!config.appId,
      appIdLength: config.appId?.length || 0,
      redirectUri,
      scopes,
      host: "www.facebook.com",
      path: "/v19.0/dialog/oauth",
    });

    return authorizationUrl;
  },

  exchangeToken: async (
    code: string,
    redirectUri: string,
    intent?: string
  ) => {
    const config = await getMetaPlatformConfig();

    const isInstagram = intent === "instagram";

    if (isInstagram) {
      /*
       * ============================================================
       * INSTAGRAM LOGIN
       * ============================================================
       *
       * IMPORTANT:
       * Instagram Login uses the Instagram App ID.
       *
       * The current Prisma model does not have separate Instagram
       * App ID / App Secret fields.
       *
       * For the immediate flow, the existing configured Meta secret
       * is used. If Instagram token exchange reports an app-secret
       * mismatch, the schema should be extended with a dedicated
       * Instagram secret.
       */
      const appId = config.instagramAppId;
      const appSecret = config.instagramAppSecret;

      if (!appId) {
        throw new Error("INSTAGRAM_APP_ID is not configured");
      }

      if (!appSecret) {
        throw new Error("Instagram App Secret not configured");
      }

      const url = "https://api.instagram.com/oauth/access_token";

      console.log("[IG-OAUTH-REDIRECT-CHECK] TOKEN EXCHANGE", {
        redirectUri,
        length: redirectUri.length,
        json: JSON.stringify(redirectUri),
        endpoint: "https://api.instagram.com/oauth/access_token",
      });

      const body = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });

      const response = await fetch(url, {
        method: "POST",
        body,
      });

      const data = await response.json();

      console.log("[IG-OAUTH-FIX] Instagram token exchange response:", {
        status: response.status,
        ok: response.ok,
        hasAccessToken: !!data?.access_token,
        hasUserId: !!data?.user_id,
        responseKeys: Object.keys(data || {}),
      });

      if (!response.ok) {
        const errorMsg = (
          data.error_message ||
          data.error?.message ||
          ""
        ).toLowerCase();

        const errorCode =
          data.error?.code ||
          data.code;

        const errorSubcode =
          data.error?.error_subcode;

        const errorType =
          data.error_type ||
          data.error?.type;
        console.log("[IG TOKEN EXCHANGE CONFIG]", {
          appId,
          appIdLength: appId?.length,
          hasAppSecret: !!appSecret,
          redirectUri,
          redirectUriLength: redirectUri.length,
          endpoint: "https://api.instagram.com/oauth/access_token",
        });
        console.error(
          `[IG Token Exchange Error] Type: ${errorType}, Code: ${errorCode}, Subcode: ${errorSubcode}, Msg: ${errorMsg}`
        );

        /*
         * Meta/Instagram errors for unsupported personal accounts.
         */
        const isPersonalAccountError =
          errorMsg.includes("business or creator") ||
          errorMsg.includes("professional account") ||
          (
            (errorCode === 10 || errorCode === 100) &&
            (
              errorMsg.includes("not supported") ||
              errorMsg.includes("personal")
            )
          );

        if (isPersonalAccountError) {
          if (
            !errorMsg.includes("validating verification code") &&
            !errorMsg.includes("redirect_uri")
          ) {
            const err = new Error(
              "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED"
            );

            (err as any).code =
              "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED";

            throw err;
          }
        }

        throw new Error(
          data.error_message ||
          data.error?.message ||
          "Failed to exchange IG token"
        );
      }

      if (!data.access_token) {
        throw new Error(
          "Instagram did not return an access token"
        );
      }

      /*
       * Exchange short-lived Instagram token
       * for a long-lived token.
       */
      const longLivedParams = new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: appSecret,
        access_token: data.access_token,
      });

      const llUrl =
        `https://graph.instagram.com/access_token?${longLivedParams.toString()}`;

      console.log("[IG-OAUTH-FIX] Long-lived token exchange:", {
        host: "graph.instagram.com",
        path: "/access_token",
        hasClientSecret: !!appSecret,
        hasAccessToken: !!data.access_token,
      });

      const llResponse = await fetch(llUrl);
      const llData = await llResponse.json();

      console.log(
        "[IG-OAUTH-FIX] Long-lived token response:",
        {
          status: llResponse.status,
          ok: llResponse.ok,
          hasAccessToken: !!llData?.access_token,
          responseKeys: Object.keys(llData || {}),
        }
      );

      if (!llResponse.ok) {
        throw new Error(
          llData.error?.message ||
          "Failed to exchange for long-lived IG token"
        );
      }

      if (!llData.access_token) {
        throw new Error(
          "Instagram long-lived token was not returned"
        );
      }

      return {
        accessToken: llData.access_token,
        tokenType: llData.token_type,
        expiresIn: llData.expires_in,
        intent: "instagram",
      };
    }

    /*
     * ============================================================
     * FACEBOOK LOGIN
     * ============================================================
     */

    const appId = config.appId;

    if (!appId) {
      throw new Error("META_APP_ID is not configured");
    }

    if (!config.appSecret) {
      throw new Error("Meta App Secret not configured");
    }

    const appSecret = config.appSecret;

    const url =
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(code)}`;

    console.log("[META-OAUTH] Facebook token exchange:", {
      intent,
      appIdPresent: !!appId,
      appIdLength: appId.length,
      redirectUri,
      endpoint: "graph.facebook.com/v19.0/oauth/access_token",
    });

    const response = await fetch(url);
    const data = await response.json();

    console.log("[META-OAUTH] Facebook token exchange response:", {
      status: response.status,
      ok: response.ok,
      hasAccessToken: !!data?.access_token,
      responseKeys: Object.keys(data || {}),
    });

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "Failed to exchange token"
      );
    }

    /*
     * Exchange Facebook short-lived token
     * for long-lived token.
     */
    const longLivedUrl =
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(data.access_token)}`;

    const llResponse = await fetch(longLivedUrl);
    const llData = await llResponse.json();

    console.log("[META-OAUTH] Facebook long-lived token response:", {
      status: llResponse.status,
      ok: llResponse.ok,
      hasAccessToken: !!llData?.access_token,
      responseKeys: Object.keys(llData || {}),
    });

    if (!llResponse.ok) {
      throw new Error(
        llData.error?.message ||
        "Failed to exchange for long-lived token"
      );
    }

    return {
      accessToken: llData.access_token,
      tokenType: llData.token_type,
      expiresIn: llData.expires_in,
      intent: "facebook",
    };
  },

  getAccountMetadata: async (credentials: any) => {
    const accessToken =
      credentials.accessToken ||
      credentials.access_token;

    if (!accessToken) {
      throw new Error("Missing access token");
    }

    if (credentials.intent === "instagram") {
      /*
       * ============================================================
       * INSTAGRAM ACCOUNT METADATA
       * ============================================================
       *
       * Instagram Login returns an Instagram Professional
       * account token.
       *
       * We resolve the Instagram account itself.
       *
       * Do NOT store the Facebook Page ID as Integration.externalId.
       */

      const response = await fetch(
        `https://graph.instagram.com/v19.0/me?fields=id,user_id,username,name,account_type&access_token=${encodeURIComponent(
          accessToken
        )}`
      );

      const data = await response.json();
      console.log("[IG-OAUTH-FULL-METADATA]", JSON.stringify(data, null, 2));

      console.log("[IG-OAUTH-FIX] Instagram account metadata:", {
        status: response.status,
        ok: response.ok,
        responseKeys: Object.keys(data || {}),
        accountId: data?.id || null,
        username: data?.username || null,
        hasName: !!data?.name,
      });

      if (!response.ok) {
        const errMsg = (
          data.error_message ||
          data.error?.message ||
          ""
        ).toLowerCase();

        const errorCode =
          data.error?.code ||
          data.code;

        const isPersonalAccountError =
          errMsg.includes("business or creator") ||
          errMsg.includes("professional account") ||
          (
            (errorCode === 10 || errorCode === 100) &&
            (
              errMsg.includes("not supported") ||
              errMsg.includes("personal")
            )
          );

        if (isPersonalAccountError) {
          const err = new Error(
            "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED"
          );

          (err as any).code =
            "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED";

          throw err;
        }

        throw new Error(
          data.error?.message ||
          data.error_message ||
          "Failed to get Instagram account metadata"
        );
      }

      if (!data.user_id) {
        throw new Error(
          "Instagram Professional Account ID (user_id) was not returned"
        );
      }

      console.log("[IG-OAUTH-FIX] Selected Instagram externalId:", {
        externalId: data.id,
        username: data.username || null,
      });

      return {
        id: data.user_id,
        name:
          data.username ||
          data.name ||
          "Instagram Professional Account",
      };
    }

    /*
     * ============================================================
     * FACEBOOK ACCOUNT METADATA
     * ============================================================
     */
    const response = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(
        accessToken
      )}`
    );

    const data = await response.json();

    console.log("[META-OAUTH] Facebook account metadata:", {
      status: response.status,
      ok: response.ok,
      responseKeys: Object.keys(data || {}),
      accountId: data?.id || null,
      hasName: !!data?.name,
    });

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "Failed to get Meta account metadata"
      );
    }

    return data;
  },

  testConnection: async (credentials: any) => {
    try {
      await metaProvider.getAccountMetadata!(credentials);
      return true;
    } catch (error) {
      console.error(
        "[META] Connection test failed:",
        error instanceof Error
          ? error.message
          : error
      );

      return false;
    }
  },

  disconnect: async (credentials: any) => {
    const accessToken =
      credentials.accessToken ||
      credentials.access_token;

    if (!accessToken) return;

    /*
     * Revoke permissions.
     */
    try {
      await fetch(
        `https://graph.facebook.com/v19.0/me/permissions?access_token=${encodeURIComponent(
          accessToken
        )}`,
        {
          method: "DELETE",
        }
      );
    } catch (e) {
      console.warn(
        "Failed to revoke Meta permissions during disconnect",
        e
      );
    }
  },

  verifyWebhookSignature: async (
    request: Request,
    rawBytes: Buffer
  ): Promise<boolean> => {
    console.log(
      "\n========== [HMAC TRACE START] =========="
    );

    /*
     * 1. Request / header diagnostics
     */
    console.log("[HMAC TRACE] Request information:", {
      method: request.method,
      url: request.url,
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      hasSignature:
        !!request.headers.get("x-hub-signature-256"),
      userAgent: request.headers.get("user-agent"),
    });

    const signature =
      request.headers.get("x-hub-signature-256");

    /*
     * DEVELOPMENT ONLY
     *
     * Temporarily bypass Meta HMAC verification
     * to validate the complete webhook processing pipeline.
     */
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.DEV_WEBHOOK_BYPASS === "true"
    ) {
      console.warn(
        "[HMAC] ⚠️ DEVELOPMENT BYPASS ENABLED — signature verification skipped"
      );

      return true;
    }

    if (!signature) {
      console.error(
        "[HMAC TRACE] ❌ Missing x-hub-signature-256"
      );

      console.log(
        "========== [HMAC TRACE END] ==========\n"
      );

      return false;
    }

    /*
     * 2. Raw body diagnostics
     */
    console.log("[HMAC TRACE] Raw body:", {
      bufferLength: rawBytes.length,
      firstByte: rawBytes[0],
      lastByte: rawBytes[rawBytes.length - 1],

      firstBytesHex: rawBytes
        .subarray(0, 16)
        .toString("hex"),

      lastBytesHex: rawBytes
        .subarray(
          Math.max(0, rawBytes.length - 16)
        )
        .toString("hex"),

      sha256: crypto
        .createHash("sha256")
        .update(rawBytes)
        .digest("hex"),
    });

    console.log("[HMAC TRACE] Raw body UTF-8:", {
      byteLength: Buffer.byteLength(
        rawBytes.toString("utf8"),
        "utf8"
      ),

      charLength:
        rawBytes.toString("utf8").length,
    });

    /*
     * 3. Meta configuration diagnostics
     */
    let appSecret: string;

    try {
      console.log(
        "[HMAC TRACE] Loading Meta platform configuration..."
      );

      const config =
        await getMetaPlatformConfig();

      console.log(
        "[HMAC TRACE] Meta configuration:",
        {
          appId: config.appId,

          hasAppSecret:
            !!config.appSecret,

          appSecretLength:
            config.appSecret?.length ?? 0,

          appSecretByteLength:
            config.appSecret
              ? Buffer.byteLength(
                config.appSecret,
                "utf8"
              )
              : 0,

          appSecretTrimmedLength:
            config.appSecret?.trim().length ?? 0,

          appSecretTrimmedByteLength:
            config.appSecret
              ? Buffer.byteLength(
                config.appSecret.trim(),
                "utf8"
              )
              : 0,

          appSecretFingerprint:
            config.appSecret
              ? crypto
                .createHash("sha256")
                .update(config.appSecret)
                .digest("hex")
              : null,

          appSecretTrimmedFingerprint:
            config.appSecret
              ? crypto
                .createHash("sha256")
                .update(
                  config.appSecret.trim()
                )
                .digest("hex")
              : null,

          instagramConfigId:
            config.instagramConfigId,

          facebookConfigId:
            config.facebookConfigId,
        }
      );

      appSecret = config.appSecret;
    } catch (error) {
      console.error(
        "[HMAC TRACE] ❌ Failed to load Meta configuration:",
        error
      );

      console.log(
        "========== [HMAC TRACE END] ==========\n"
      );

      return false;
    }

    if (!appSecret) {
      console.error(
        "[HMAC TRACE] ❌ App Secret is empty"
      );

      console.log(
        "========== [HMAC TRACE END] ==========\n"
      );

      return false;
    }

    const secret = appSecret.trim();

    /*
     * 4. HMAC calculation
     */
    console.log("[HMAC TRACE] HMAC input:", {
      algorithm: "sha256",
      secretByteLength:
        Buffer.byteLength(secret, "utf8"),
      bodyByteLength: rawBytes.length,
      updateInputType: "Buffer",
      updateInputLength: rawBytes.length,
    });

    const calculatedHash = crypto
      .createHmac("sha256", secret)
      .update(rawBytes)
      .digest("hex");

    const expectedSignature =
      `sha256=${calculatedHash}`;

    const receivedSignature =
      signature.trim();

    /*
     * 5. NEVER print actual signatures.
     */
    console.log(
      "[HMAC TRACE] Signature comparison:",
      {
        receivedLength:
          receivedSignature.length,

        expectedLength:
          expectedSignature.length,

        receivedPrefix:
          receivedSignature.substring(0, 7),

        expectedPrefix:
          expectedSignature.substring(0, 7),

        receivedSignatureFingerprint:
          crypto
            .createHash("sha256")
            .update(receivedSignature)
            .digest("hex"),

        expectedSignatureFingerprint:
          crypto
            .createHash("sha256")
            .update(expectedSignature)
            .digest("hex"),

        receivedHexFingerprint:
          crypto
            .createHash("sha256")
            .update(
              receivedSignature.substring(7),
              "utf8"
            )
            .digest("hex"),

        calculatedHexFingerprint:
          crypto
            .createHash("sha256")
            .update(
              calculatedHash,
              "utf8"
            )
            .digest("hex"),
      }
    );

    /*
     * 6. Byte-by-byte comparison
     */
    const receivedBuffer =
      Buffer.from(
        receivedSignature,
        "utf8"
      );

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    console.log(
      "[HMAC TRACE] Buffer comparison:",
      {
        receivedBufferLength:
          receivedBuffer.length,

        expectedBufferLength:
          expectedBuffer.length,

        sameLength:
          receivedBuffer.length ===
          expectedBuffer.length,
      }
    );

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {
      console.error(
        "[HMAC TRACE] ❌ LENGTH MISMATCH"
      );

      console.log(
        "========== [HMAC TRACE END] ==========\n"
      );

      return false;
    }

    let differingBytes = 0;
    let firstDifference = -1;

    for (
      let i = 0;
      i < receivedBuffer.length;
      i++
    ) {
      if (
        receivedBuffer[i] !==
        expectedBuffer[i]
      ) {
        differingBytes++;

        if (firstDifference === -1) {
          firstDifference = i;
        }
      }
    }

    console.log(
      "[HMAC TRACE] Byte comparison:",
      {
        differingBytes,
        firstDifference,
        identical:
          differingBytes === 0,
      }
    );

    /*
     * 7. Timing-safe comparison
     */
    const isMatch =
      crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      );

    console.log(
      `[HMAC TRACE] FINAL RESULT: ${isMatch
        ? "✅ MATCH"
        : "❌ MISMATCH"
      }`
    );

    console.log(
      "========== [HMAC TRACE END] ==========\n"
    );

    return isMatch;
  },

  extractEvents: (
    payload: any
  ): NormalizedWebhookEvent[] => {
    const events: NormalizedWebhookEvent[] = [];

    if (
      payload.object !== "page" &&
      payload.object !== "instagram"
    ) {
      return events;
    }

    for (
      const entry of payload.entry || []
    ) {
      const accountId = entry.id;

      /*
       * ============================================================
       * Messaging events
       * ============================================================
       */

      for (
        const messagingEvent of
        entry.messaging || []
      ) {
        const messageId =
          messagingEvent.message?.mid;

        events.push({
          externalEventId:
            messageId ||
            `${accountId}_${messagingEvent.timestamp || Date.now()}`,

          eventType: "message",

          accountId,

          payload: messagingEvent,
        });
      }

      /*
       * ============================================================
       * Change events
       * ============================================================
       */

      for (
        const changesEvent of
        entry.changes || []
      ) {
        const field =
          changesEvent.field;

        const value =
          changesEvent.value || {};

        /*
         * Instagram messages can arrive as:
         *
         * entry.changes[].field === "messages"
         */
        if (
          payload.object === "instagram" &&
          field === "messages"
        ) {
          const messageId =
            value.message?.mid;

          events.push({
            externalEventId:
              messageId ||
              `${accountId}_${value.sender?.id || "unknown"}_${value.timestamp || Date.now()}`,

            eventType: "message",

            accountId,

            payload: value,
          });

          continue;
        }

        /*
         * ==========================================================
         * Lead generation events
         * ==========================================================
         */

        if (value.leadgen_id) {
          events.push({
            externalEventId:
              value.leadgen_id,

            eventType: field,

            accountId,

            payload: value,
          });

          continue;
        }

        /*
         * ==========================================================
         * Other change events
         * ==========================================================
         */

        events.push({
          externalEventId:
            `${accountId}_${field}_${Date.now()}_${Math.random()}`,

          eventType: field,

          accountId,

          payload: value,
        });
      }
    }

    return events;
  },

  getLeadDetails: async (
    credentials: any,
    leadId: string
  ) => {
    const accessToken =
      credentials.accessToken ||
      credentials.access_token;

    if (!accessToken) {
      throw new Error(
        "Missing Meta access token"
      );
    }

    /*
     * Fetch lead details from Graph API.
     */
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${leadId}?fields=created_time,id,ad_id,form_id,field_data,campaign_id,adset_id&access_token=${encodeURIComponent(
        accessToken
      )}`
    );

    const data =
      await response.json();

    if (!response.ok) {
      /*
       * Differentiate errors.
       */
      if (data.error?.code === 190) {
        const err: any =
          new Error(
            "Meta access token invalid or expired"
          );

        err.code = "AUTH_FAILED";

        throw err;
      }

      throw new Error(
        data.error?.message ||
        "Failed to fetch lead details"
      );
    }

    /*
     * Normalize field_data.
     */
    const fieldData =
      data.field_data || [];

    const normalized: Record<
      string,
      string
    > = {};

    const customFields: Record<
      string,
      string
    > = {};

    for (
      const field of fieldData
    ) {
      const val =
        field.values &&
          field.values.length > 0
          ? field.values[0]
          : null;

      if (!val) continue;

      const name =
        field.name.toLowerCase();

      switch (name) {
        case "email":
          normalized.email =
            val.toLowerCase().trim();
          break;

        case "phone_number":
          normalized.phone =
            val.replace(
              /[^\d+]/g,
              ""
            );
          break;

        case "first_name":
          normalized.firstName = val;
          break;

        case "last_name":
          normalized.lastName = val;
          break;

        case "full_name":
          normalized.name = val;
          break;

        case "company_name":
          normalized.companyName = val;
          break;

        case "job_title":
          normalized.jobTitle = val;
          break;

        case "city":
          normalized.city = val;
          break;

        case "state":
          normalized.state = val;
          break;

        case "country":
          normalized.country = val;
          break;

        case "zip":
        case "post_code":
          normalized.postalCode = val;
          break;

        default:
          customFields[field.name] =
            val;
          break;
      }
    }

    /*
     * Ensure we have a name.
     */
    if (!normalized.name) {
      if (
        normalized.firstName &&
        normalized.lastName
      ) {
        normalized.name =
          `${normalized.firstName} ${normalized.lastName}`;
      } else if (
        normalized.firstName
      ) {
        normalized.name =
          normalized.firstName;
      } else if (
        normalized.lastName
      ) {
        normalized.name =
          normalized.lastName;
      } else {
        normalized.name =
          "Unknown Lead";
      }
    }

    return {
      externalLeadId: data.id,

      createdTime:
        data.created_time,

      adId:
        data.ad_id,

      formId:
        data.form_id,

      campaignId:
        data.campaign_id,

      adsetId:
        data.adset_id,

      normalized,

      customFields,
    };
  },
};