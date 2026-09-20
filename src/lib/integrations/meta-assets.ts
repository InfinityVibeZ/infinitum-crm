import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type MetaAsset = {
  type: "PAGE" | "INSTAGRAM";
  externalId: string;
  name: string;
  metadata?: Prisma.InputJsonValue;
};

export async function discoverMetaAssets(
  accessToken: string,
  includeInstagram = true
): Promise<MetaAsset[]> {
  const pagesResponse = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`
  );
  const pagesData = await pagesResponse.json();

  if (!pagesResponse.ok) {
    throw new Error(
      pagesData.error?.message || "Failed to fetch Facebook Pages"
    );
  }

  const discoveredAssets: MetaAsset[] = [];

  for (const page of pagesData.data || []) {
    discoveredAssets.push({
      type: "PAGE",
      externalId: page.id,
      name: page.name,
    });

    if (includeInstagram && page.instagram_business_account?.id) {
      const instagramResponse = await fetch(
        `https://graph.facebook.com/v19.0/${page.instagram_business_account.id}?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`
      );
      if (instagramResponse.ok) {
        const instagramData = await instagramResponse.json();
        discoveredAssets.push({
          type: "INSTAGRAM",
          externalId: instagramData.id,
          name:
            instagramData.name ||
            instagramData.username ||
            "Instagram Account",
          metadata: {
            username: instagramData.username,
            linkedPageId: page.id,
          },
        });
      }
    }
  }

  return discoveredAssets;
}

export async function saveMetaAssets({
  integrationId,
  companyId,
  provider,
  assets,
  accessToken,
}: {
  integrationId: string;
  companyId: string;
  provider: string;
  assets: MetaAsset[];
  accessToken: string;
}) {
  const savedAssets = [];

  for (const asset of assets) {
    const saved = await prisma.integrationAsset.upsert({
      where: {
        integrationId_assetType_externalId: {
          integrationId,
          assetType: asset.type,
          externalId: asset.externalId,
        },
      },
      update: {
        name: asset.name,
        metadata: asset.metadata || {},
        isActive: true,
      },
      create: {
        integrationId,
        companyId,
        provider,
        assetType: asset.type,
        externalId: asset.externalId,
        name: asset.name,
        metadata: asset.metadata || {},
        isActive: true,
      },
    });
    savedAssets.push(saved);

    if (asset.type !== "PAGE") continue;

    const pageTokenResponse = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(accessToken)}`
    );
    const pageTokenData = await pageTokenResponse.json();

    if (!pageTokenResponse.ok) {
      throw new Error(
        pageTokenData.error?.message ||
          "Failed to retrieve Facebook Page access token"
      );
    }

    const page = (pageTokenData.data || []).find(
      (candidate: { id: string }) => candidate.id === asset.externalId
    );

    if (!page?.access_token) {
      throw new Error(
        `No Page access token found for Facebook Page ${asset.externalId}`
      );
    }

    const subscribeResponse = await fetch(
      `https://graph.facebook.com/v19.0/${asset.externalId}/subscribed_apps`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: page.access_token,
          subscribed_fields: "messages",
        }),
      }
    );
    const subscribeData = await subscribeResponse.json();

    console.log("[META PAGE SUBSCRIPTION]", {
      pageId: asset.externalId,
      status: subscribeResponse.status,
      ok: subscribeResponse.ok,
      response: subscribeData,
    });

    if (!subscribeResponse.ok) {
      throw new Error(
        subscribeData.error?.message ||
          "Failed to subscribe Meta Page to webhook"
      );
    }
  }

  return savedAssets;
}
