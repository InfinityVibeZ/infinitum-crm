-- Accelerate case-insensitive substring searches used by Inbox search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "contacts_name_trgm_idx"
  ON "contacts" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "messages_content_trgm_idx"
  ON "messages" USING GIN ("content" gin_trgm_ops);
