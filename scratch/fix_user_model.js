const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  'model User {\n    id',
  'model User {\n    conversations_assigned Conversation[] @relation("ConversationAssignedUser")\n    messages_sent Message[] @relation("MessageSenderUser")\n    id'
);

fs.writeFileSync(schemaPath, schema);
