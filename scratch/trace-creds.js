const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function decrypt(encryptedData) {
  if (!encryptedData) return null;
  try {
    const KEY = process.env.SMTP_ENCRYPTION_KEY;
    const key = Buffer.from(KEY, 'hex');
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let d = decipher.update(ciphertext, undefined, 'utf8');
    d += decipher.final('utf8');
    return d;
  } catch(e) { return null; }
}

function safeFingerprint(secret) {
  if (!secret) return "null";
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex").substring(0, 16) + "...";
}

async function traceCredentials() {
  try {
    const config = await prisma.platformMetaConfiguration.findFirst();
    if (!config) {
      console.log("No config found.");
      return;
    }
    
    console.log("=== PlatformMetaConfiguration ===");
    console.log("App ID:", config.appId);
    console.log("enabled:", config.enabled);
    
    const fields = Object.keys(config).filter(k => k.toLowerCase().includes('secret') || k.toLowerCase().includes('token'));
    
    for (const field of fields) {
      const val = config[field];
      const decrypted = decrypt(val) || val; 
      console.log(`Field: ${field}`);
      console.log(`  Value exists: ${!!val}`);
      console.log(`  Decrypted exists: ${decrypted !== val ? "YES (decrypted)" : "NO/RAW"}`);
      console.log(`  Fingerprint: ${safeFingerprint(decrypted)}`);
      if (decrypted) {
         console.log(`  Length: ${Buffer.byteLength(String(decrypted), 'utf8')}`);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

traceCredentials();
