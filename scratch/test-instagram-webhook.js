process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const crypto = require('crypto');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function decrypt(encryptedData) {
  const KEY = process.env.SMTP_ENCRYPTION_KEY;
  if (!KEY) throw new Error('SMTP_ENCRYPTION_KEY env var not set');
  const key = Buffer.from(KEY, 'hex');
  if (key.length !== 32) throw new Error('SMTP_ENCRYPTION_KEY must be a 64-char hex string');
  const parts = encryptedData.split(':');
  if (parts.length !== 3) return encryptedData;
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const ciphertext = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function httpsPost(path, headers, body) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.request(
      { hostname: 'localhost', port: 3000, path, method: 'POST', headers, agent },
      res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function waitForStatus(externalEventId, targetStatuses, maxWaitMs) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const e = await prisma.integrationWebhookEvent.findUnique({
      where: { provider_externalEventId: { provider: 'INSTAGRAM', externalEventId } },
      include: { integration: { select: { id: true, companyId: true } } },
    });
    if (e && targetStatuses.includes(e.status)) return e;
    await new Promise(r => setTimeout(r, 500));
  }
  // Return whatever state it's in after timeout
  return prisma.integrationWebhookEvent.findUnique({
    where: { provider_externalEventId: { provider: 'INSTAGRAM', externalEventId } },
    include: { integration: { select: { id: true, companyId: true } } },
  });
}

async function main() {
  const config = await prisma.platformMetaConfiguration.findFirst();
  if (!config || !config.enabled || !config.encryptedAppSecret) {
    throw new Error('Meta config missing or not enabled');
  }
  const appSecret = decrypt(config.encryptedAppSecret);

  const integration = await prisma.integration.findFirst({
    where: { provider: 'INSTAGRAM', status: 'CONNECTED' },
    select: { id: true, companyId: true, externalId: true },
  });
  if (!integration) throw new Error('No CONNECTED Instagram integration found');

  const REAL_IG_ACCOUNT_ID = integration.externalId;
  const externalEventId = 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const payload = {
    object: 'instagram',
    entry: [{
      id: REAL_IG_ACCOUNT_ID,
      time: Math.floor(Date.now() / 1000),
      messaging: [{
        sender: { id: 'IG_SENDER_TEST_001' },
        recipient: { id: REAL_IG_ACCOUNT_ID },
        timestamp: Date.now(),
        message: { mid: externalEventId, text: 'Test DM from automated webhook test' },
      }],
    }],
  };
  const rawBody = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const { status: httpStatus, body: responseBody } = await httpsPost(
    '/api/webhooks/integrations/instagram',
    {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
      'Content-Length': Buffer.byteLength(rawBody),
    },
    rawBody
  );

  // Poll until PROCESSED or FAILED (up to 10 seconds)
  const webhookEvent = await waitForStatus(externalEventId, ['PROCESSED', 'FAILED'], 10000);

  console.log('WEBHOOK E2E TEST');
  console.log('----------------');
  console.log('HTTP response:', httpStatus);
  if (httpStatus !== 200) console.log('Response body:', responseBody.substring(0, 300));
  if (!webhookEvent) {
    console.log('Webhook event: FAIL (not persisted in DB)');
  } else {
    const pass = webhookEvent.status === 'PROCESSED';
    console.log('Webhook event:', pass ? 'PASS' : 'FAIL');
    console.log('Event status:', webhookEvent.status);
    if (webhookEvent.errorMessage) console.log('Error message:', webhookEvent.errorMessage);
    console.log('Integration linked:', webhookEvent.integrationId ? 'YES' : 'NO');
    console.log('Tenant isolation:', webhookEvent.integration?.companyId === integration.companyId ? 'PASS' : 'FAIL');
  }
  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('Error:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
