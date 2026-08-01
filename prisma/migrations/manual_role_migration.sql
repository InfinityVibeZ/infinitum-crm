-- Manual migration: Replace old Role enum with new 3-role system
-- Step 1: Add new enum types
DO $$ BEGIN
  CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add a temporary column with the new type, mapping old roles
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_new" "Role_new" NOT NULL DEFAULT 'USER';

-- Step 3: Map existing roles to new roles
UPDATE "users" SET "role_new" = 'SUPER_ADMIN' WHERE "role"::text = 'ADMIN';
UPDATE "users" SET "role_new" = 'USER'        WHERE "role"::text IN ('MANAGER','SETTER','CLOSER','EMPLOYEE');

-- Step 4: Drop old role column
ALTER TABLE "users" DROP COLUMN "role";

-- Step 5: Rename new column
ALTER TABLE "users" RENAME COLUMN "role_new" TO "role";

-- Step 6: Drop old enum
DROP TYPE IF EXISTS "Role";

-- Step 7: Rename new enum
ALTER TYPE "Role_new" RENAME TO "Role";

-- Step 8: Add UserStatus column to users if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "modules" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login" TIMESTAMP(3);
