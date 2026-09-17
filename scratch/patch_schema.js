const fs = require('fs');

const schemaPath = './prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// The new models and enums
const newModels = `
// ==========================================
// Phase 3.8.1 - Unified Inbox
// ==========================================

enum ConversationChannel {
  META_INSTAGRAM
  META_FACEBOOK
  WHATSAPP
  EMAIL
  SMS
  PLATFORM
}

enum ConversationStatus {
  OPEN
  CLOSED
  SNOOZED
  ARCHIVED
}

enum ParticipantRole {
  CUSTOMER
  AGENT
  BOT
  OBSERVER
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageSenderType {
  CONTACT
  USER
  SYSTEM
  BOT
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  FILE
  LOCATION
  SYSTEM
  TEMPLATE
}

enum MessageStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
}

model Conversation {
  id                     String              @id @default(uuid()) @db.Uuid
  companyId              String              @map("company_id") @db.Uuid
  contactId              String              @map("contact_id") @db.Uuid
  integrationId          String?             @map("integration_id") @db.Uuid
  channel                ConversationChannel
  externalConversationId String?             @map("external_conversation_id")
  status                 ConversationStatus  @default(OPEN)
  assignedUserId         String?             @map("assigned_user_id") @db.Uuid
  assignedTeamId         String?             @map("assigned_team_id") @db.Uuid
  lastMessageAt          DateTime?           @map("last_message_at")
  createdAt              DateTime            @default(now()) @map("created_at")
  updatedAt              DateTime            @updatedAt @map("updated_at")
  metadata               Json?

  company       Company                   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  contact       Contact                   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  integration   Integration?              @relation(fields: [integrationId], references: [id], onDelete: SetNull)
  assignedUser  User?                     @relation("ConversationAssignedUser", fields: [assignedUserId], references: [id], onDelete: SetNull)
  assignedTeam  Team?                     @relation(fields: [assignedTeamId], references: [id], onDelete: SetNull)
  
  participants  ConversationParticipant[]
  messages      Message[]

  @@unique([integrationId, externalConversationId])
  @@index([companyId])
  @@index([contactId])
  @@index([status])
  @@map("conversations")
}

model ConversationParticipant {
  id                 String          @id @default(uuid()) @db.Uuid
  conversationId     String          @map("conversation_id") @db.Uuid
  contactId          String?         @map("contact_id") @db.Uuid
  externalIdentityId String?         @map("external_identity_id")
  role               ParticipantRole
  metadata           Json?
  createdAt          DateTime        @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  contact      Contact?     @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@unique([conversationId, contactId])
  @@map("conversation_participants")
}

model Message {
  id                String            @id @default(uuid()) @db.Uuid
  companyId         String            @map("company_id") @db.Uuid
  conversationId    String            @map("conversation_id") @db.Uuid
  externalMessageId String?           @map("external_message_id")
  direction         MessageDirection
  senderType        MessageSenderType
  senderUserId      String?           @map("sender_user_id") @db.Uuid
  messageType       MessageType       @default(TEXT)
  body              String?
  status            MessageStatus     @default(PENDING)
  sentAt            DateTime          @default(now()) @map("sent_at")
  createdAt         DateTime          @default(now()) @map("created_at")
  updatedAt         DateTime          @updatedAt @map("updated_at")
  metadata          Json?

  company      Company             @relation(fields: [companyId], references: [id], onDelete: Cascade)
  conversation Conversation        @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderUser   User?               @relation("MessageSenderUser", fields: [senderUserId], references: [id], onDelete: SetNull)
  
  attachments  MessageAttachment[]

  @@unique([conversationId, externalMessageId])
  @@index([companyId])
  @@index([sentAt])
  @@map("messages")
}

model MessageAttachment {
  id        String      @id @default(uuid()) @db.Uuid
  messageId String      @map("message_id") @db.Uuid
  type      MessageType
  url       String
  mimeType  String?     @map("mime_type")
  fileName  String?     @map("file_name")
  size      Int?
  metadata  Json?

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@map("message_attachments")
}
`;

function appendToModel(modelName, fieldDefinition) {
    const regex = new RegExp(`(model\\s+${modelName}\\s+{[^}]*?)(\\n})`, 's');
    if (!regex.test(schema)) {
        console.warn(`Could not find model ${modelName}`);
        return;
    }
    // Check if it already has the field to prevent duplicates
    const match = schema.match(regex);
    if (match[1].includes(fieldDefinition.trim().split(' ')[0])) {
        console.log(`Model ${modelName} already has the field.`);
        return;
    }
    schema = schema.replace(regex, "$1\n  " + fieldDefinition + "$2");
}

// Append new models at the bottom
if (!schema.includes("model Conversation {")) {
    schema += "\n" + newModels + "\n";
}

// Add back-relations
appendToModel('Company', 'conversations    Conversation[]');
appendToModel('Company', 'messages         Message[]');
appendToModel('Contact', 'conversations    Conversation[]');
appendToModel('Contact', 'conversationParticipants ConversationParticipant[]');
appendToModel('Integration', 'conversations    Conversation[]');
appendToModel('Team', 'conversations    Conversation[]');
appendToModel('User', 'assignedConversations Conversation[] @relation("ConversationAssignedUser")');
appendToModel('User', 'sentMessages          Message[]      @relation("MessageSenderUser")');

fs.writeFileSync(schemaPath, schema);
console.log('Schema patched successfully.');
