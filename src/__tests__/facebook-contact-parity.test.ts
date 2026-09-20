import { test } from "node:test";
import assert from "node:assert";
import { PrismaClient } from "@prisma/client";
import { resolveContactIdentity } from "../lib/integrations/identity-service.ts";

const prisma = new PrismaClient();

const isPlaceholderName = (name?: string | null) =>
  !name || name === "Unknown" || name === "FACEBOOK User" || name === "INSTAGRAM User";

test("resolveContactIdentity enriches an existing Facebook contact instead of leaving the placeholder", async () => {
  const company = await prisma.company.create({
    data: {
      name: `fb-parity-${Date.now()}`,
      isActive: true,
      status: "ACTIVE",
    },
  });

  const integration = await prisma.integration.create({
    data: {
      companyId: company.id,
      provider: "META",
      type: "OAUTH",
      externalId: `fb-integration-${Date.now()}`,
      displayName: "Facebook",
      status: "CONNECTED",
      isActive: true,
    } as any,
  });

  const contact = await prisma.contact.create({
    data: {
      companyId: company.id,
      name: "FACEBOOK User",
      customFields: null,
    } as any,
  });

  await prisma.contactIdentity.create({
    data: {
      companyId: company.id,
      contactId: contact.id,
      provider: "META",
      externalId: "28435311666108371",
      integrationId: integration.id,
    } as any,
  });

  const result = await resolveContactIdentity(prisma, {
    companyId: company.id,
    provider: "META",
    externalId: "28435311666108371",
    integrationId: integration.id,
    contactData: {
      name: "Alex Messenger",
      customFields: {
        facebook: {
          username: null,
          name: "Alex Messenger",
          externalId: "28435311666108371",
          profilePictureUrl: "https://cdn.example.com/alex.jpg",
        },
      },
    },
  });

  assert.equal(result.status, "MATCHED");
  assert.equal(result.contactId, contact.id);

  const updated = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: {
      id: true,
      name: true,
      customFields: true,
    },
  });

  assert.ok(updated, "contact should exist");
  assert.equal(updated!.name, "Alex Messenger");
  assert.ok(!isPlaceholderName(updated!.name));

  const customFields = (updated!.customFields as Record<string, any>) || {};
  assert.equal(customFields.facebook?.name, "Alex Messenger");
  assert.equal(customFields.facebook?.externalId, "28435311666108371");
  assert.equal(customFields.facebook?.profilePictureUrl, "https://cdn.example.com/alex.jpg");

  await prisma.contactIdentity.deleteMany({ where: { contactId: contact.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
  await prisma.integration.delete({ where: { id: integration.id } });
  await prisma.company.delete({ where: { id: company.id } });
});
