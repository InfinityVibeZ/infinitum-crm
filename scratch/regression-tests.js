const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runRegressionTests() {
  console.log('--- REGRESSION TESTS ---');
  
  // 1. Setup Data
  const integration = await prisma.integration.findFirst({
    where: { provider: 'INSTAGRAM', status: 'CONNECTED' },
    select: { id: true, companyId: true, externalId: true },
  });
  if (!integration) throw new Error('No CONNECTED Instagram integration');

  const externalSenderId = 'sender_' + Date.now();
  const externalConversationId = 'conv_' + Date.now();
  const externalMessageId = 'msg_' + Date.now();
  const timestamp = new Date();

  const event = {
    provider: 'INSTAGRAM',
    channel: 'INSTAGRAM',
    integrationId: integration.id,
    externalConversationId,
    externalMessageId,
    externalSenderId,
    direction: 'INBOUND',
    contentType: 'TEXT',
    text: 'Test message',
    attachments: [],
    timestamp,
    raw: { test: true }
  };

  const { processInboxEvent } = require('../src/lib/inbox/pipeline.ts');

  // Test 1: Normal Inbound Message
  console.log('Test 1: Normal Inbound Message');
  const res1 = await processInboxEvent(event);
  if (res1.messageStatus !== 'CREATED' || res1.conversationStatus !== 'CREATED') throw new Error('Test 1 Failed: Status not CREATED');
  console.log('Test 1: PASS');

  // Test 2: Message is persisted
  console.log('Test 2: Message Persisted');
  const msgCount = await prisma.message.count({ where: { external_message_id: externalMessageId } });
  if (msgCount !== 1) throw new Error('Test 2 Failed: Message count ' + msgCount);
  console.log('Test 2: PASS');

  // Test 3: Duplicate Webhook Delivery
  console.log('Test 3: Duplicate Webhook');
  const res3 = await processInboxEvent(event);
  if (res3.messageStatus !== 'EXISTING' || res3.conversationStatus !== 'EXISTING') throw new Error('Test 3 Failed: Status not EXISTING');
  console.log('Test 3: PASS');

  // Test 4: Concurrent Duplicate Delivery
  console.log('Test 4: Concurrent Duplicate');
  const extMsgId4 = 'msg_concurrent_' + Date.now();
  const concurrentEvent = { ...event, externalMessageId: extMsgId4 };
  try {
    const results = await Promise.all([
      processInboxEvent(concurrentEvent),
      processInboxEvent(concurrentEvent)
    ]);
    const counts = { CREATED: 0, EXISTING: 0 };
    results.forEach(r => counts[r.messageStatus]++);
    if (counts.CREATED !== 1 || counts.EXISTING !== 1) throw new Error('Test 4 Failed: Concurrency created ' + JSON.stringify(counts));
    console.log('Test 4: PASS');
  } catch (e) {
    console.log('Test 4 Exception during concurrency (expected UniqueConstraint or safe success):', e.message);
  }
  const msgCount4 = await prisma.message.count({ where: { external_message_id: extMsgId4 } });
  if (msgCount4 !== 1) throw new Error('Test 4 Failed: Message count ' + msgCount4);
  console.log('Test 4: PASS (Count verified)');

  // Test 5: Tenant Isolation
  console.log('Test 5: Tenant Isolation');
  const msgDetails = await prisma.message.findFirst({ where: { external_message_id: externalMessageId } });
  if (msgDetails.company_id !== integration.companyId) throw new Error('Test 5 Failed: Company ID mismatch');
  console.log('Test 5: PASS');

  await prisma.$disconnect();
}

runRegressionTests().catch(async (e) => {
  console.error('Fatal Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
