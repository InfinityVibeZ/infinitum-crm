import { prisma } from "@/lib/prisma";
import { ContactIdentityType } from "@prisma/client";

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  return trimmed.toLowerCase();
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.replace(/[\s\-\(\)]/g, ""); // Strip whitespace, dashes, parens
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

export type IdentityStatus = "CREATED" | "MATCHED" | "CONFLICT" | "AMBIGUOUS";

export interface ResolveIdentityParams {
  companyId: string;
  provider: string;
  externalId?: string;
  email?: string | null;
  phone?: string | null;
  integrationId?: string | null;
  contactData?: {
    name?: string;
    companyName?: string;
    jobTitle?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    customFields?: any;
  };
  metadata?: any;
}

export interface ResolveIdentityResult {
  status: IdentityStatus;
  contactId: string | null;
  matchedBy?: "PROVIDER" | "EMAIL" | "PHONE";
  conflicts?: any[];
}

function isPlaceholderContactName(name?: string | null): boolean {
  if (!name) return true;
  return [
    "Unknown",
    "FACEBOOK User",
    "INSTAGRAM User",
  ].includes(name.trim());
}

export async function resolveContactIdentity(
  tx: any,
  params: ResolveIdentityParams
): Promise<ResolveIdentityResult> {
  const { companyId, provider, externalId, email, phone, integrationId, contactData, metadata } = params;

  const nEmail = normalizeEmail(email);
  const nPhone = normalizePhone(phone);

  let matchCandidates = new Set<string>();
  let matchReason: "PROVIDER" | "EMAIL" | "PHONE" | undefined;

  // 1. Try Exact Provider External Identity
  if (externalId) {
    const existingIdentity = await tx.contactIdentity.findUnique({
      where: {
        companyId_provider_externalId: {
          companyId,
          provider,
          externalId
        }
      }
    });

    if (existingIdentity) {
      matchCandidates.add(existingIdentity.contactId);
      matchReason = "PROVIDER";
    }
  }

  // 2. Try Exact Normalized Email
  let emailContact = null;
  if (nEmail) {
    emailContact = await tx.contact.findUnique({
      where: {
        companyId_normalizedEmail: {
          companyId,
          normalizedEmail: nEmail
        }
      }
    });
    if (emailContact) {
      matchCandidates.add(emailContact.id);
      if (!matchReason) matchReason = "EMAIL";
    }
  }

  // 3. Try Exact Normalized Phone
  let phoneContact = null;
  if (nPhone) {
    phoneContact = await tx.contact.findUnique({
      where: {
        companyId_normalizedPhone: {
          companyId,
          normalizedPhone: nPhone
        }
      }
    });
    if (phoneContact) {
      matchCandidates.add(phoneContact.id);
      if (!matchReason) matchReason = "PHONE";
    }
  }

  if (matchCandidates.size > 1) {
    return {
      status: "CONFLICT",
      contactId: null,
      conflicts: Array.from(matchCandidates)
    };
  }

  let finalContactId: string;
  let status: IdentityStatus = "CREATED";

  if (matchCandidates.size === 1) {
    finalContactId = Array.from(matchCandidates)[0];
    status = "MATCHED";

    // Enrich existing contact if new non-empty data is provided.
    // Placeholder values such as "FACEBOOK User" are not real CRM data and
    // must be overwritten with the real provider profile from the webhook.
    const updateData: any = {};
    const existingContact = await tx.contact.findUnique({ where: { id: finalContactId } });
    if (existingContact) {
      if (nEmail && !existingContact.normalizedEmail) {
        updateData.email = email;
        updateData.normalizedEmail = nEmail;
      }
      if (nPhone && !existingContact.normalizedPhone) {
        updateData.phone = phone;
        updateData.normalizedPhone = nPhone;
      }
      if (contactData) {
        if (contactData.name && (isPlaceholderContactName(existingContact.name) || !existingContact.name)) {
          updateData.name = contactData.name;
        }
        if (contactData.companyName && !existingContact.companyName) updateData.companyName = contactData.companyName;

        if (
          contactData.customFields &&
          typeof contactData.customFields === "object" &&
          !Array.isArray(contactData.customFields)
        ) {
          const existingCustomFields =
            existingContact.customFields &&
            typeof existingContact.customFields === "object" &&
            !Array.isArray(existingContact.customFields)
              ? (existingContact.customFields as Record<string, unknown>)
              : {};

          const mergedCustomFields = {
            ...existingCustomFields,
            ...contactData.customFields,
          };

          if (JSON.stringify(existingCustomFields) !== JSON.stringify(mergedCustomFields)) {
            updateData.customFields = mergedCustomFields;
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        await tx.contact.update({
          where: { id: finalContactId },
          data: updateData
        });
      }
    }
  } else {
    // Create new contact
    const newContact = await tx.contact.create({
      data: {
        companyId,
        name: contactData?.name || "Unknown",
        email: email || null,
        normalizedEmail: nEmail,
        phone: phone || null,
        normalizedPhone: nPhone,
        companyName: contactData?.companyName,
        jobTitle: contactData?.jobTitle,
        city: contactData?.city,
        state: contactData?.state,
        country: contactData?.country,
        postalCode: contactData?.postalCode,
        customFields: contactData?.customFields
      }
    });
    finalContactId = newContact.id;
  }

  // Ensure ContactIdentity exists for this provider
  if (externalId) {
    const existingIdentity = await tx.contactIdentity.findUnique({
      where: {
        companyId_provider_externalId: {
          companyId,
          provider,
          externalId
        }
      }
    });

    if (!existingIdentity) {
      await tx.contactIdentity.create({
        data: {
          companyId,
          contactId: finalContactId,
          provider,
          identityType: ContactIdentityType.PROVIDER_EXTERNAL_ID,
          integrationId,
          externalId,
          metadata
        }
      });
    }
  }

  return {
    status,
    contactId: finalContactId,
    matchedBy: matchReason
  };
}
