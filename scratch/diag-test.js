process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const crypto = require('crypto');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function decrypt(encryptedData) {
  const KEY = process.env.SMTP_ENCRYPTION_KEY;
  if (!KEY) throw new Error('SMTP_ENCRYPTION_KEY env var not set');
  const key = Buffer.from(KEY, 'hex');
  if (key.length !== 32) throw new Error('SMTP_ENCRYPTION_KEY must be 64-char hex');
  const parts = encryptedData.split(':');
  if (parts.length !== 3) return encryptedData;
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const ciphertext = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let d = decipher.update(ciphertext, undefined, 'utf8');
  d += decipher.final('utf8');
  return d;
}

function httpsPost(path, headers, body) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.request(
      { hostname: 'localhost', port: 3000, path, method: 'POST', headers, agent },
      res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const config = await prisma.platformMetaConfiguration.findFirst();
  if (!config || !config.encryptedAppSecret) throw new Error('Meta config missing');
  const appSecret = decrypt(config.encryptedAppSecret);

  const integration = await prisma.integration.findFirst({
    where: { provider: 'INSTAGRAM', status: 'CONNECTED' },
    select: { id: true, companyId: true, externalId: true },
  });
  if (!integration) throw new Error('No CONNECTED Instagram integration');

  const externalEventId = 'diag_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const payload = {
    object: 'instagram',
    entry: [{ id: integration.externalId, time: Math.floor(Date.now()/1000),
      messaging: [{ sender: { id: 'DIAG_SENDER' }, recipient: { id: integration.externalId },
        timestamp: Date.now(), message: { mid: externalEventId, text: 'Diagnostic test' } }] }],
  };
  const rawBody = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const { status, headers, body } = await httpsPost(
    '/api/webhooks/integrations/instagram',
    { 'Content-Type': 'application/json', 'x-hub-signature-256': signature, 'Content-Length': Buffer.byteLength(rawBody) },
    rawBody
  );

  console.log('--- LOCAL TEST RESULTS ---');
  console.log('HTTP status:', status);
  console.log('X-Nexus-Webhook-Diagnostic header:', headers['x-nexus-webhook-diagnostic'] || 'NOT PRESENT');
  console.log('Body:', body);
  await prisma.$disconnect();
})().catch(async e => { console.error('Error:', e.message); await prisma.$disconnect(); process.exit(1); });
