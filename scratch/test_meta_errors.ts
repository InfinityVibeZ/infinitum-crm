import { metaProvider } from '../src/lib/integrations/providers/meta';
import { prisma } from '../src/lib/prisma';
import { encrypt } from '../src/lib/encryption';

const originalFetch = global.fetch;

async function testSuccess() {
  console.log("=== Testing Success ===");
  global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    if (url.toString().includes('oauth/access_token')) {
      return {
        ok: true,
        json: async () => ({ access_token: "short_lived_token" })
      } as Response;
    }
    if (url.toString().includes('graph.instagram.com/access_token')) {
      return {
        ok: true,
        json: async () => ({ access_token: "long_lived_token", token_type: "bearer", expires_in: 3600 })
      } as Response;
    }
    return originalFetch(url, init);
  };
  
  try {
    const res = await metaProvider.exchangeToken!("dummy_code", "dummy_uri", "instagram");
    console.log("Success result:", res.accessToken === "long_lived_token" ? "PASS" : "FAIL");
  } catch (e: any) {
    console.log("Success failed:", e.message);
  }
}

async function testPersonalAccount() {
  console.log("=== Testing Personal Account ===");
  global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    if (url.toString().includes('oauth/access_token')) {
      return {
        ok: false,
        json: async () => ({
          error_message: "User must be a business or creator account to use this endpoint",
          error_type: "OAuthException",
          error: { code: 100 }
        })
      } as Response;
    }
    return originalFetch(url, init);
  };
  
  try {
    await metaProvider.exchangeToken!("dummy_code", "dummy_uri", "instagram");
    console.log("Personal account failed: Did not throw");
  } catch (e: any) {
    console.log("Personal account result:", e.code === "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED" ? "PASS" : `FAIL: ${e.code} / ${e.message}`);
  }
}

async function testUnrelatedError() {
  console.log("=== Testing Unrelated Error ===");
  global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    if (url.toString().includes('oauth/access_token')) {
      return {
        ok: false,
        json: async () => ({
          error_message: "Error validating verification code. Please make sure your redirect_uri is identical...",
          error_type: "OAuthException"
        })
      } as Response;
    }
    return originalFetch(url, init);
  };
  
  try {
    await metaProvider.exchangeToken!("dummy_code", "dummy_uri", "instagram");
    console.log("Unrelated error failed: Did not throw");
  } catch (e: any) {
    console.log("Unrelated error result:", e.code === "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED" ? "FAIL: Categorized as Personal" : `PASS: ${e.message}`);
  }
}

async function main() {
  // Setup dummy DB config
  const existingConfig = await prisma.platformMetaConfiguration.findFirst();
  if (!existingConfig) {
    await prisma.platformMetaConfiguration.create({
      data: {
        appId: "123",
        encryptedAppSecret: encrypt("fb_secret"),
        instagramAppId: "456",
        encryptedInstagramAppSecret: encrypt("ig_secret"),
        enabled: true
      }
    });
  }

  await testSuccess();
  await testPersonalAccount();
  await testUnrelatedError();
  
  process.exit(0);
}

main();
