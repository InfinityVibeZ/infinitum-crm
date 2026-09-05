import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";

/**
 * Determines if a subscription is considered "active" enough to grant entitlements.
 */
export function isSubscriptionActive(status?: SubscriptionStatus): boolean {
  if (!status) return false;
  return ["ACTIVE", "TRIALING", "PAST_DUE"].includes(status);
}

/**
 * Get the active subscription for a company.
 */
export async function getCompanySubscription(companyId?: string) {
  if (!companyId) return null;
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    include: {
      plan: {
        include: {
          features: {
            include: {
              feature: true,
            },
          },
        },
      },
      entitlementOverrides: {
        include: {
          feature: true,
        },
      },
    },
  });

  return subscription;
}

/**
 * Get the effective entitlements for a company.
 * Returns a map of featureCode -> { enabled, limitValue, limitType, configuration }.
 * Combines plan features and subscription overrides.
 */
export async function getEffectiveEntitlements(companyId?: string) {
  const entitlements = new Map<string, any>();
  if (!companyId) return entitlements;

  const sub = await getCompanySubscription(companyId);
  if (!sub || !isSubscriptionActive(sub.status)) {
    return entitlements;
  }

  // 1. Load features from the base plan
  if (sub.plan && sub.plan.features) {
    for (const pf of sub.plan.features) {
      if (pf.feature) {
        entitlements.set(pf.feature.code, {
          enabled: pf.enabled,
          limitValue: pf.limitValue,
          limitType: pf.limitType,
          configuration: pf.configuration,
        });
      }
    }
  }

  // 2. Apply subscription-level entitlement overrides
  const now = new Date();
  if (sub.entitlementOverrides) {
    for (const override of sub.entitlementOverrides) {
      if (override.startsAt > now) continue;
      if (override.endsAt && override.endsAt < now) continue;

      if (override.feature) {
        const existing = entitlements.get(override.feature.code) || {};
        entitlements.set(override.feature.code, {
          ...existing,
          enabled: override.enabled !== null ? override.enabled : existing.enabled,
          limitValue: override.limitValue !== null ? override.limitValue : existing.limitValue,
          configuration: override.configuration !== null ? override.configuration : existing.configuration,
        });
      }
    }
  }

  return entitlements;
}

/**
 * Check if a company has a specific feature enabled.
 */
export async function hasFeature(companyId: string | undefined, featureCode: string): Promise<boolean> {
  if (!companyId) return false;
  const entitlements = await getEffectiveEntitlements(companyId);
  const feature = entitlements.get(featureCode);
  return feature ? feature.enabled : false;
}
