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

async function checkSecret() {
  const config = await prisma.platformMetaConfiguration.findFirst();
  if (config) {
    const rawSecret = decrypt(config.encryptedAppSecret);
    console.log("Secret length:", rawSecret.length);
    console.log("Secret characters (hex):", Buffer.from(rawSecret).toString('hex'));
    console.log("Ends with newline?", rawSecret.endsWith('\n'));
    console.log("Ends with space?", rawSecret.endsWith(' '));
    console.log("Has quotes?", rawSecret.includes('"'));
  }
}
checkSecret().finally(() => prisma.$disconnect());
