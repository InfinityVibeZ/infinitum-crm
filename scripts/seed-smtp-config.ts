import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
// Inline encrypt implementation (same as src/lib/encryption.ts)
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY; // 64‑hex chars (32 bytes)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('SMTP_ENCRYPTION_KEY is not defined in environment variables');
  }
  let key: Buffer;
  try {
    key = Buffer.from(ENCRYPTION_KEY, 'hex');
    if (key.length !== 32) throw new Error();
  } catch {
    throw new Error('SMTP_ENCRYPTION_KEY must be a 64‑character hex string (32 bytes)');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}


// EDIT THESE VALUES OR PROVIDE ENV VARS BEFORE RUNNING
const SMTP_HOST = process.env.SMTP_HOST!;
const SMTP_PORT = Number(process.env.SMTP_PORT!);
const SMTP_USER = process.env.SMTP_USER!;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD!; // password sourced from env
const SMTP_FROM = process.env.SMTP_FROM!;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME!;
const SMTP_SERVICE = process.env.SMTP_SERVICE!; // optional (gmail, sendgrid, ses, ...)

/** Helper to upsert a config key/value pair */
async function upsert(key: string, value: string, prisma: PrismaClient) {
  const existing = await prisma.systemConfig.findFirst({ where: { key } });
  if (existing) {
    await prisma.systemConfig.update({ where: { id: existing.id }, data: { value } });
    console.log(`🔁 Updated ${key}`);
  } else {
    await prisma.systemConfig.create({ data: { id: crypto.randomUUID(), key, value } });
    console.log(`✨ Created ${key}`);
  }
}

async function main() {
  const prisma = new PrismaClient();

  // Non‑sensitive settings (stored plain)
  await upsert('SMTP_HOST', SMTP_HOST, prisma);
  await upsert('SMTP_PORT', String(SMTP_PORT), prisma);
  await upsert('SMTP_USER', SMTP_USER, prisma);
  await upsert('SMTP_FROM', SMTP_FROM, prisma);
  await upsert('SMTP_FROM_NAME', SMTP_FROM_NAME, prisma);
  await upsert('SMTP_SERVICE', SMTP_SERVICE, prisma);

  // Encrypt password before persisting
  const encryptedPass = await encrypt(SMTP_PASSWORD);
  await upsert('SMTP_PASS', encryptedPass, prisma);

  console.log('✅ SMTP configuration seeded (password encrypted).');
  // Password is not logged for security
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error seeding SMTP config:', e);
  process.exit(1);
});
