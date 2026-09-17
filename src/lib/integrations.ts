import { encrypt, decrypt } from "./encryption";
import { prisma } from "./prisma";

/**
 * Creates a new integration with the provided metadata and encrypted credentials
 */
export async function createIntegration({
  companyId,
  provider,
  type,
  externalId,
  displayName,
  credentialsPayload,
  connectionMeta,
}: {
  companyId: string;
  provider: string;
  type: string;
  externalId: string;
  displayName: string;
  credentialsPayload: any; // Raw object with access_token, etc.
  connectionMeta?: any;
}) {
  // Encrypt the sensitive payload
  const encryptedData = encrypt(JSON.stringify(credentialsPayload));

  return prisma.integration.create({
    data: {
      companyId,
      provider,
      type,
      externalId,
      displayName,
      connectionMeta: connectionMeta || {},
      status: "CONNECTED",
      lastSyncAt: new Date(),
      credentials: {
        create: {
          encryptedData,
        },
      },
    },
    include: {
      credentials: true,
    },
  });
}

/**
 * Updates an integration's status (e.g. if token expires or disconnected)
 */
export async function updateIntegrationStatus(
  integrationId: string,
  companyId: string, // for tenant isolation
  status: "PENDING" | "CONNECTED" | "ERROR" | "DISCONNECTED",
  errorMessage?: string,
  updateSyncTime?: boolean
) {
  const data: any = {
    status,
    errorMessage,
  };

  if (updateSyncTime) {
    data.lastSyncAt = new Date();
  }

  return prisma.integration.update({
    where: {
      id: integrationId,
      companyId, // Ensure it belongs to the tenant
    },
    data,
  });
}

/**
 * Decrypts and retrieves the credentials for an integration
 */
export async function getIntegrationCredentials(integrationId: string, companyId: string) {
  const credential = await prisma.integrationCredential.findFirst({
    where: {
      integration: {
        id: integrationId,
        companyId, // Tenant isolation check
      },
    },
  });

  if (!credential) {
    throw new Error("Credentials not found or unauthorized");
  }

  try {
    const decryptedString = decrypt(credential.encryptedData);
    return JSON.parse(decryptedString);
  } catch (error) {
    throw new Error("Failed to decrypt or parse integration credentials");
  }
}

/**
 * Soft or hard delete the integration
 */
export async function deleteIntegration(integrationId: string, companyId: string) {
  // For safety, hard delete cascade will remove credentials too
  return prisma.integration.delete({
    where: {
      id: integrationId,
      companyId, // tenant check
    },
  });
}
