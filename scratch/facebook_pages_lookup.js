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
  const c = await prisma.conversation.findUnique({
    where: { id: '684ad37d-a6fc-4845-8988-b21111fe4b80' },
    include: { integration: true },
  });
  const ic = await prisma.integrationCredential.findUnique({
    where: { integrationId: c.integration_id },
  });
  const payload = ic && ic.encryptedData ? JSON.parse(decrypt(ic.encryptedData)) : null;
  const token = payload.accessToken || payload.access_token;
  console.log('TOKEN_LENGTH', token.length);
  console.log('START_FETCH');
  const response = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(token)}`);
  const text = await response.text();
  console.log('STATUS', response.status);
  console.log('BODY_PREFIX', text.slice(0, 400));
})();
