const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function encrypt(text) {
  const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY;
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + tag + ':' + encrypted;
}

async function run() {
  const userConf = await prisma.systemConfig.findFirst({ where: { key: 'SMTP_USER' } });
  if (userConf) {
    await prisma.systemConfig.update({ where: { id: userConf.id }, data: { value: 'builtby.rajum@gmail.com' } });
  } else {
    await prisma.systemConfig.create({ data: { key: 'SMTP_USER', value: 'builtby.rajum@gmail.com' } });
  }

  const fromConf = await prisma.systemConfig.findFirst({ where: { key: 'SMTP_FROM' } });
  if (fromConf) {
    await prisma.systemConfig.update({ where: { id: fromConf.id }, data: { value: 'builtby.rajum@gmail.com' } });
  } else {
    await prisma.systemConfig.create({ data: { key: 'SMTP_FROM', value: 'builtby.rajum@gmail.com' } });
  }

  const pw = 'rczf hhpa nker djnz'.replace(/ /g, '');
  const passConf = await prisma.systemConfig.findFirst({ where: { key: 'SMTP_PASS' } });
  if (passConf) {
    await prisma.systemConfig.update({ where: { id: passConf.id }, data: { value: encrypt(pw) } });
  } else {
    await prisma.systemConfig.create({ data: { key: 'SMTP_PASS', value: encrypt(pw) } });
  }
  console.log('DB updated');
  await prisma.$disconnect();
}

run().catch(console.error);
