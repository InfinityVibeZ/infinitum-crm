-- CreateIndex
CREATE UNIQUE INDEX "conversations_integration_id_external_conversation_id_key" ON "conversations"("integration_id", "external_conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversation_id_external_message_id_key" ON "messages"("conversation_id", "external_message_id");
