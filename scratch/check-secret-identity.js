const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function decrypt(encryptedData) {
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
}

async function checkSecretIdentity() {
  try {
    const config = await prisma.platformMetaConfiguration.findFirst();
    if (!config) {
      console.log("No config found.");
      return;
    }
    
    console.log("App ID:", config.appId);
    
    const secret = decrypt(config.encryptedAppSecret);
    const secretByteLength = Buffer.byteLength(secret, "utf8");
    const trimmedSecret = secret.trim();
    const trimmedByteLength = Buffer.byteLength(trimmedSecret, "utf8");
    const whitespaceDiff = secretByteLength !== trimmedByteLength;
    
    const fingerprint = crypto.createHash("sha256").update(secret, "utf8").digest("hex");
    const trimmedFingerprint = crypto.createHash("sha256").update(trimmedSecret, "utf8").digest("hex");
    
    console.log("Stored Secret Length:", secretByteLength);
    console.log("Trimmed Length:", trimmedByteLength);
    console.log("Whitespace difference:", whitespaceDiff ? "YES" : "NO");
    console.log("Secret Fingerprint (SHA-256):", fingerprint);
    if (whitespaceDiff) {
      console.log("Trimmed Fingerprint (SHA-256):", trimmedFingerprint);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSecretIdentity();
