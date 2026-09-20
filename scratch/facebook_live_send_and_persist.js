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
  const conversationId = '684ad37d-a6fc-4845-8988-b21111fe4b80';
  const text = 'Hello from CRM';

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      external_conversation_id: true,
      channel: true,
      integration_id: true,
      company_id: true,
    },
  });

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversation_id: conversationId,
      role: 'CUSTOMER',
      external_identity_id: { not: null },
    },
    select: { external_identity_id: true },
  });

  const externalConversationId = conversation?.external_conversation_id || null;
  const pageId = externalConversationId ? externalConversationId.split('_')[0] : null;
  const recipientId = participant?.external_identity_id || (externalConversationId ? externalConversationId.split('_')[1] : null);

  console.log(JSON.stringify({
    conversationId,
    channel: conversation?.channel,
    externalConversationId,
    pageId,
    recipientId,
  }, null, 2));

  const user = await prisma.user.findFirst({
    where: { companyId: conversation.company_id },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const integrationCredential = await prisma.integrationCredential.findUnique({
    where: { integrationId: conversation.integration_id },
    select: { encryptedData: true },
  });

  const credentials = integrationCredential && integrationCredential.encryptedData
    ? JSON.parse(decrypt(integrationCredential.encryptedData))
    : null;

  const userAccessToken = credentials?.accessToken || credentials?.access_token;
  const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(userAccessToken)}`);
  const pagesData = await pagesResponse.json();
  const page = Array.isArray(pagesData?.data)
    ? pagesData.data.find((item) => String(item?.id) === String(pageId))
    : null;
  const pageAccessToken = page?.access_token;

  console.log(JSON.stringify({
    pagesStatus: pagesResponse.status,
    pageAccessTokenFound: !!pageAccessToken,
    pageCount: Array.isArray(pagesData?.data) ? pagesData.data.length : null,
  }, null, 2));

  if (!pageAccessToken || !pageId || !recipientId) {
    console.log(JSON.stringify({ ok: false, reason: 'Missing page token or recipient' }, null, 2));
    process.exit(1);
  }

  const sendResponse = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: pageAccessToken,
    }),
  });

  const sendData = await sendResponse.json();
  console.log(JSON.stringify({
    sendStatus: sendResponse.status,
    ok: sendResponse.ok,
    response: sendData,
  }, null, 2));

  if (!sendResponse.ok || !sendData?.message_id) {
    console.log(JSON.stringify({ ok: false, reason: 'Meta rejected send', error: sendData?.error || null }, null, 2));
    process.exit(0);
  }

  const before = await prisma.message.count({
    where: { conversation_id: conversationId, direction: 'OUTBOUND', content: text },
  });

  if (before > 0) {
    console.log(JSON.stringify({ alreadySent: true, beforeCount: before }, null, 2));
    process.exit(0);
  }

  const message = await prisma.message.create({
    data: {
      company_id: conversation.company_id,
      conversation_id: conversationId,
      external_message_id: String(sendData.message_id),
      direction: 'OUTBOUND',
      sender_type: 'USER',
      sender_user_id: user?.id ?? null,
      content: text,
      content_type: 'TEXT',
      status: 'SENT',
      metadata: {
        provider: 'FACEBOOK',
        pageId,
        recipientId,
        rawResponse: sendData,
      },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { last_message_at: new Date() },
  });

  const after = await prisma.message.count({
    where: { conversation_id: conversationId, direction: 'OUTBOUND', content: text },
  });

  const lastMessages = await prisma.message.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: { id: true, content: true, direction: true, status: true, external_message_id: true },
  });

  console.log(JSON.stringify({
    persisted: { id: message.id, externalMessageId: message.external_message_id },
    beforeCount: before,
    afterCount: after,
    lastMessages,
  }, null, 2));
})();
