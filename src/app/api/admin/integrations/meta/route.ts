import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, requireRole } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;

    const roleError = requireRole(auth.payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const config = await prisma.platformMetaConfiguration.findFirst();

    if (!config) {
      return NextResponse.json({
        appId: "",
        hasAppSecret: false,
        hasWebhookVerifyToken: false,
        facebookConfigId: "",
        instagramConfigId: "",
        instagramAppId: "",
        hasInstagramAppSecret: false,
        enabled: false,
      });
    }

    return NextResponse.json({
      appId: config.appId,
      hasAppSecret: !!config.encryptedAppSecret,
      hasWebhookVerifyToken: !!config.encryptedWebhookVerifyToken,

      facebookConfigId: config.facebookConfigId || "",
      instagramConfigId: config.instagramConfigId || "",

      // Instagram Login credentials
      instagramAppId: config.instagramAppId || "",
      hasInstagramAppSecret: !!config.encryptedInstagramAppSecret,

      enabled: config.enabled,
    });
  } catch (error: any) {
    console.error("Failed to fetch meta config:", error);

    return NextResponse.json(
      { error: "Failed to fetch meta configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;

    const roleError = requireRole(auth.payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const {
      appId,
      appSecret,
      webhookVerifyToken,
      facebookConfigId,
      instagramConfigId,
      instagramAppId,
      instagramAppSecret,
      enabled,
    } = await request.json();

    console.log("[META-CONFIG] Save request:", {
      hasAppId: !!appId,
      hasAppSecret: !!appSecret,
      hasWebhookVerifyToken: !!webhookVerifyToken,
      hasFacebookConfigId: !!facebookConfigId,
      hasInstagramConfigId: !!instagramConfigId,
      hasInstagramAppId: !!instagramAppId,
      hasInstagramAppSecret: !!instagramAppSecret,
      enabled: !!enabled,
    });

    const existingConfig =
      await prisma.platformMetaConfiguration.findFirst();

    const dataToSave: any = {
      appId: appId || "",
      facebookConfigId: facebookConfigId || "",
      instagramConfigId: instagramConfigId || "",
      instagramAppId: instagramAppId || "",
      enabled: !!enabled,
    };

    /*
     * Meta App Secret
     *
     * Empty value means:
     * "Keep the existing secret."
     */
    if (appSecret) {
      dataToSave.encryptedAppSecret = encrypt(appSecret);
    } else if (!existingConfig) {
      dataToSave.encryptedAppSecret = "";
    }

    /*
     * Instagram App Secret
     *
     * Empty value means:
     * "Keep the existing Instagram secret."
     */
    if (instagramAppSecret) {
      dataToSave.encryptedInstagramAppSecret =
        encrypt(instagramAppSecret);
    } else if (!existingConfig) {
      dataToSave.encryptedInstagramAppSecret = "";
    }

    /*
     * Webhook Verify Token
     *
     * Empty value means:
     * "Keep the existing token."
     */
    if (webhookVerifyToken) {
      dataToSave.encryptedWebhookVerifyToken =
        encrypt(webhookVerifyToken);
    } else if (!existingConfig) {
      dataToSave.encryptedWebhookVerifyToken = "";
    }

    if (existingConfig) {
      await prisma.platformMetaConfiguration.update({
        where: {
          id: existingConfig.id,
        },
        data: dataToSave,
      });

      console.log("[META-CONFIG] Configuration updated:", {
        id: existingConfig.id,
        instagramAppId: instagramAppId || "",
        instagramSecretUpdated: !!instagramAppSecret,
      });
    } else {
      const created =
        await prisma.platformMetaConfiguration.create({
          data: dataToSave,
        });

      console.log("[META-CONFIG] Configuration created:", {
        id: created.id,
        instagramAppId: instagramAppId || "",
        instagramSecretConfigured: !!instagramAppSecret,
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Failed to save meta config:", error);

    return NextResponse.json(
      { error: "Failed to save meta configuration" },
      { status: 500 }
    );
  }
}