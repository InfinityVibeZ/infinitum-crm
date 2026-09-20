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

async function safeJsonFetch(url) {
  const response = await fetch(url);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  return { status: response.status, ok: response.ok, data };
}

(async () => {
  const conversationId = '684ad37d-a6fc-4845-8988-b21111fe4b80';
  const expectedPageId = '1373297189192429';

  const config = await prisma.platformMetaConfiguration.findFirst({
    where: { enabled: true },
    select: {
      appId: true,
      encryptedAppSecret: true,
      enabled: true,
      facebookConfigId: true,
    },
  });

  if (!config) {
    console.log(JSON.stringify({ error: 'No enabled Meta platform config found' }, null, 2));
    return;
  }

  const appSecret = decrypt(config.encryptedAppSecret);
  const appAccessToken = `${config.appId}|${appSecret}`;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, external_conversation_id: true, channel: true, integration_id: true },
  });

  if (!conversation) {
    console.log(JSON.stringify({ error: 'Conversation not found' }, null, 2));
    return;
  }

  const integrationCredential = await prisma.integrationCredential.findUnique({
    where: { integrationId: conversation.integration_id },
    select: { encryptedData: true },
  });

  const credentials = integrationCredential?.encryptedData ? JSON.parse(decrypt(integrationCredential.encryptedData)) : null;
  const userAccessToken = credentials?.accessToken || credentials?.access_token;

  const userDebug = await safeJsonFetch(
    `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
  );

  const meAccounts = await safeJsonFetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userAccessToken)}`
  );

  const page = Array.isArray(meAccounts.data?.data)
    ? meAccounts.data.data.find((item) => String(item.id) === expectedPageId)
    : null;

  const pageAccessToken = page?.access_token || null;

  const pageDebug = pageAccessToken
    ? await safeJsonFetch(
        `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
      )
    : null;

  const appMeta = await safeJsonFetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(config.appId)}?fields=id,name,app_type,category,link&access_token=${encodeURIComponent(appAccessToken)}`
  );

  const userScopes = userDebug.data?.data?.scopes || [];
  const pageScopes = pageDebug?.data?.data?.scopes || [];

  const summary = {
    appId: config.appId,
    configuredFacebookConfigId: config.facebookConfigId || null,
    appAccessTokenPresent: !!appAccessToken,
    conversationId: conversation.id,
    channel: conversation.channel,
    externalConversationId: conversation.external_conversation_id || null,
    userTokenValid: !!userDebug.data?.data?.is_valid,
    userTokenType: userDebug.data?.data?.type || null,
    userTokenExpiresAt: userDebug.data?.data?.expires_at || null,
    userTokenAppId: userDebug.data?.data?.app_id || null,
    userTokenAppMatchesConfiguredApp: String(userDebug.data?.data?.app_id || '') === String(config.appId),
    userGrantedScopes: Array.isArray(userScopes) ? userScopes : [],
    hasPagesMessagingUserToken: Array.isArray(userScopes) && userScopes.includes('pages_messaging'),
    pageIdReturnedByMeAccounts: page?.id || null,
    pageNameReturnedByMeAccounts: page?.name || null,
    pageTokenValid: !!pageDebug?.data?.data?.is_valid,
    pageTokenType: pageDebug?.data?.data?.type || null,
    pageTokenExpiresAt: pageDebug?.data?.data?.expires_at || null,
    pageTokenAppId: pageDebug?.data?.data?.app_id || null,
    pageTokenAppMatchesConfiguredApp: String(pageDebug?.data?.data?.app_id || '') === String(config.appId),
    pageGrantedScopes: Array.isArray(pageScopes) ? pageScopes : [],
    hasPagesMessagingPageToken: Array.isArray(pageScopes) && pageScopes.includes('pages_messaging'),
    expectedPageId,
    pageIdMatchesExpected: String(page?.id || '') === String(expectedPageId),
    debugUserStatus: userDebug.status,
    debugPageStatus: pageDebug?.status || null,
    meAccountsStatus: meAccounts.status,
    appGraphStatus: appMeta.status,
    appGraphName: appMeta.data?.name || null,
    appGraphAppType: appMeta.data?.app_type || null,
    appModeHint: appMeta.data?.app_type || null,
  };

  console.log(JSON.stringify(summary, null, 2));
})();
