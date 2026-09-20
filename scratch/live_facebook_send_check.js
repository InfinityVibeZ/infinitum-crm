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
  const convoId = '684ad37d-a6fc-4845-8988-b21111fe4b80';
  const c = await prisma.conversation.findUnique({
    where: { id: convoId },
    include: { integration: true },
  });

  if (!c) {
    console.log(JSON.stringify({ found: false }));
    return;
  }

  const ic = await prisma.integrationCredential.findUnique({
    where: { integrationId: c.integration_id },
  });

  const payload = ic && ic.encryptedData ? JSON.parse(decrypt(ic.encryptedData)) : null;

  console.log(JSON.stringify({
    found: true,
    channel: c.channel,
    integrationId: c.integration_id,
    hasCredentials: !!payload,
    hasUserAccessToken: !!(payload && (payload.accessToken || payload.access_token)),
    smtpEncryptionKeyLoaded: !!process.env.SMTP_ENCRYPTION_KEY,
  }, null, 2));

  if (!payload) return;

  const pageId = '1373297189192429';
  const recipientId = '28435311666108371';

  const response = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(payload.accessToken || payload.access_token)}`
  );
  const pagesData = await response.json();
  const page = Array.isArray(pagesData?.data)
    ? pagesData.data.find((item) => String(item?.id) === String(pageId))
    : null;
  const pageAccessToken = page?.access_token;

  console.log(JSON.stringify({
    pagesStatus: response.status,
    pageAccessTokenFound: !!pageAccessToken,
    pageCount: Array.isArray(pagesData?.data) ? pagesData.data.length : null,
  }, null, 2));

  if (!pageAccessToken) return;

  const sendResponse = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: 'Hello from CRM' },
        access_token: pageAccessToken,
      }),
    }
  );

  const data = await sendResponse.json();
  console.log(JSON.stringify({
    sendStatus: sendResponse.status,
    ok: sendResponse.ok,
    data,
  }, null, 2));
})();
