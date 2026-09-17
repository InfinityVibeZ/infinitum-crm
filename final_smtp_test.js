const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

function decrypt(encryptedData) {
  const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) throw new Error('SMTP_ENCRYPTION_KEY not set');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const parts = encryptedData.split(':');
  if (parts.length !== 3) return encryptedData; // not encrypted
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['SMTP_USER','SMTP_PASS','SMTP_HOST','SMTP_PORT','SMTP_FROM','SMTP_FROM_NAME'] } }
    });
    const cfg = {};
    configs.forEach(c => cfg[c.key] = c.value);
    const smtpUser = cfg['SMTP_USER'];
    const rawPass = cfg['SMTP_PASS'];
    const smtpPass = rawPass ? decrypt(rawPass) : '';
    console.log('SMTP_USER:', smtpUser);
    console.log('password present:', !!rawPass);
    console.log('decrypted password length:', smtpPass.length);
    const host = cfg['SMTP_HOST'] || 'smtp.gmail.com';
    const port = parseInt(cfg['SMTP_PORT'] || '587', 10);
    const fromName = cfg['SMTP_FROM_NAME'] || 'Infinity Vibez Team';
    const fromEmail = cfg['SMTP_FROM'] || smtpUser;
    const from = `${fromName} <${fromEmail}>`;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.verify();
    console.log('SMTP_VERIFY: PASS');
    const info = await transporter.sendMail({
      from,
      to: 'mouli.ec109@gmail.com',
      subject: 'CRM SMTP Test',
      text: 'CRM SMTP test email.',
    });
    console.log('SEND_RESULT', JSON.stringify({
      envelopeFrom: info.envelope.from,
      envelopeTo: info.envelope.to,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      messageId: info.messageId,
    }));
  } catch (err) {
    console.error('ERROR', err);
  } finally {
    await prisma.$disconnect();
  }
})();
