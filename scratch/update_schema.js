const fs = require('fs');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// Inject inverse relations

// User
if (!schema.includes('conversations_assigned Conversation[] @relation("ConversationAssignedUser")')) {
  schema = schema.replace(
    'model User {', 
    'model User {\n  conversations_assigned Conversation[] @relation("ConversationAssignedUser")\n  messages_sent Message[] @relation("MessageSenderUser")'
  );
}

// Company
if (!schema.includes('conversations Conversation[]')) {
  schema = schema.replace(
    'model Company {',
    'model Company {\n  conversations Conversation[]\n  messages Message[]'
  );
}

// Integration
if (!schema.includes('conversations Conversation[]')) {
  schema = schema.replace(
    'model Integration {',
    'model Integration {\n  conversations Conversation[]'
  );
}

// Contact
if (!schema.includes('conversations Conversation[]')) {
  schema = schema.replace(
    'model Contact {',
    'model Contact {\n  conversations Conversation[]\n  conversation_participants ConversationParticipant[]\n  messages Message[]'
  );
}

// Team
if (!schema.includes('conversations Conversation[]')) {
  schema = schema.replace(
    'model Team {',
    'model Team {\n  conversations Conversation[]'
  );
}

const appendSchema = fs.readFileSync('scratch/append_schema.prisma', 'utf8');
if (!schema.includes('model Conversation {')) {
  schema += '\n' + appendSchema;
}

fs.writeFileSync(schemaPath, schema);
console.log('Schema updated with new models and relations');
