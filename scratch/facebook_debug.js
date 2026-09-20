const fs = require('fs');
const path = '.env';
if (fs.existsSync(path)) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) process.env[key] = value;
  }
}

require('ts-node/register/transpile-only');
const { prisma } = require('../src/lib/prisma.ts');
const { decrypt } = require('../src/lib/encryption.ts');

(async () => {
  console.log('STEP1');
  const c = await prisma.conversation.findUnique({
    where: { id: '684ad37d-a6fc-4845-8988-b21111fe4b80' },
    include: { integration: true },
  });
  console.log('STEP2', !!c, c?.channel, c?.integration_id, c?.integration?.provider);

  const ic = await prisma.integrationCredential.findUnique({
    where: { integrationId: c.integration_id },
  });
  console.log('STEP3', !!ic, !!ic?.encryptedData);

  const payload = ic && ic.encryptedData ? JSON.parse(decrypt(ic.encryptedData)) : null;
  console.log('STEP4', !!payload, !!(payload && (payload.accessToken || payload.access_token)), Object.keys(payload || {}).slice(0, 10));
})();
