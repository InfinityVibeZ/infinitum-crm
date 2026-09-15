import { prisma } from "@/lib/prisma";
import { AttributionPlatform, AttributionChannel, AttributionSourceType } from "@prisma/client";

/**
 * Normalizes UTM values to a consistent format (lowercase, trimmed).
 */
export function normalizeUTM(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") return null;
  return trimmed.toLowerCase();
}

export interface RawAttributionData {
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  adSetName?: string;
  adId?: string;
  adName?: string;
  creativeId?: string;
  creativeName?: string;
  formId?: string;
  formName?: string;
  externalEventId?: string;
  landingPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  capturedAt?: Date;
}

/**
 * Determines the platform, channel, and source type based on the provider and payload context.
 */
export function resolveSource(provider: string, context?: any): { platform: AttributionPlatform, channel: AttributionChannel, sourceType: AttributionSourceType } {
  let platform: AttributionPlatform = AttributionPlatform.UNKNOWN;
  let channel: AttributionChannel = AttributionChannel.UNKNOWN;
  let sourceType: AttributionSourceType = AttributionSourceType.UNKNOWN;

  const providerUpper = provider.toUpperCase();

  if (providerUpper === "META" || providerUpper === "FACEBOOK" || providerUpper === "INSTAGRAM") {
    platform = AttributionPlatform.META;
    sourceType = AttributionSourceType.LEAD_AD;
    
    // Attempt to distinguish FB vs IG from context if provided
    if (context && context.source_platform) {
      const sp = context.source_platform.toLowerCase();
      if (sp === "ig" || sp === "instagram") {
        channel = AttributionChannel.INSTAGRAM;
      } else {
        channel = AttributionChannel.FACEBOOK;
      }
    } else {
      channel = AttributionChannel.FACEBOOK; // Default assumption for Meta Lead Ads
    }
  } else if (providerUpper === "GOOGLE") {
    platform = AttributionPlatform.GOOGLE;
    channel = AttributionChannel.SEARCH;
    sourceType = AttributionSourceType.LEAD_AD;
  } else if (providerUpper === "WEBSITE") {
    platform = AttributionPlatform.WEBSITE;
    channel = AttributionChannel.WEBSITE;
    sourceType = AttributionSourceType.WEBSITE_FORM;
  }

  return { platform, channel, sourceType };
}

/**
 * Idempotently captures an attribution touch and updates the corresponding Contact/Lead.
 */
export async function captureTouch(tx: any, companyId: string, contactId: string | null, leadId: string | null, integrationId: string | null, provider: string, raw: RawAttributionData, context?: any) {
  const { platform, channel, sourceType } = resolveSource(provider, context);

  let touchId: string;

  // Try to deduplicate if we have an external event ID
  if (raw.externalEventId) {
    const existing = await tx.attributionTouch.findUnique({
      where: {
        companyId_platform_externalEventId: {
          companyId,
          platform,
          externalEventId: raw.externalEventId
        }
      }
    });

    if (existing) {
      touchId = existing.id;
      // If we are passing a new leadId/contactId, we might want to update the touch to link it.
      if ((leadId && !existing.leadId) || (contactId && !existing.contactId)) {
        await tx.attributionTouch.update({
          where: { id: existing.id },
          data: {
            leadId: leadId || existing.leadId,
            contactId: contactId || existing.contactId
          }
        });
      }
    } else {
      const newTouch = await tx.attributionTouch.create({
        data: {
          companyId,
          contactId,
          leadId,
          integrationId,
          platform,
          channel,
          sourceType,
          campaignId: raw.campaignId,
          campaignName: raw.campaignName,
          adSetId: raw.adSetId,
          adSetName: raw.adSetName,
          adId: raw.adId,
          adName: raw.adName,
          creativeId: raw.creativeId,
          creativeName: raw.creativeName,
          formId: raw.formId,
          formName: raw.formName,
          externalEventId: raw.externalEventId,
          landingPage: raw.landingPage,
          referrer: raw.referrer,
          utmSource: normalizeUTM(raw.utmSource),
          utmMedium: normalizeUTM(raw.utmMedium),
          utmCampaign: normalizeUTM(raw.utmCampaign),
          utmTerm: normalizeUTM(raw.utmTerm),
          utmContent: normalizeUTM(raw.utmContent),
          capturedAt: raw.capturedAt || new Date()
        }
      });
      touchId = newTouch.id;
    }
  } else {
    // If no externalEventId is provided, we just create a new touch. (Deduplication relies on caller supplying it).
    const newTouch = await tx.attributionTouch.create({
      data: {
        companyId,
        contactId,
        leadId,
        integrationId,
        platform,
        channel,
        sourceType,
        campaignId: raw.campaignId,
        campaignName: raw.campaignName,
        adSetId: raw.adSetId,
        adSetName: raw.adSetName,
        adId: raw.adId,
        adName: raw.adName,
        creativeId: raw.creativeId,
        creativeName: raw.creativeName,
        formId: raw.formId,
        formName: raw.formName,
        landingPage: raw.landingPage,
        referrer: raw.referrer,
        utmSource: normalizeUTM(raw.utmSource),
        utmMedium: normalizeUTM(raw.utmMedium),
        utmCampaign: normalizeUTM(raw.utmCampaign),
        utmTerm: normalizeUTM(raw.utmTerm),
        utmContent: normalizeUTM(raw.utmContent),
        capturedAt: raw.capturedAt || new Date()
      }
    });
    touchId = newTouch.id;
  }

  // Update Lead's firstTouch/lastTouch
  if (leadId) {
    const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { firstTouchId: true } });
    if (lead) {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          firstTouchId: lead.firstTouchId ? undefined : touchId,
          lastTouchId: touchId
        }
      });
    }
  }

  return touchId;
}
