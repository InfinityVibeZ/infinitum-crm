const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

schema = schema.replace(/  conversations_assigned.*\n/g, '');
schema = schema.replace(/  messages_sent.*\n/g, '');
schema = schema.replace(/  conversations Conversation\[\]\n/g, '');
schema = schema.replace(/  messages Message\[\]\n/g, '');
schema = schema.replace(/  conversation_participants ConversationParticipant\[\]\n/g, '');

fs.writeFileSync(schemaPath, schema);
